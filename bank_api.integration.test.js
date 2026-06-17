/**
 * ============================================================
 *  BANK API — Tests d'intégration PostgreSQL (Docker)
 *  Prérequis : docker compose up -d db
 *  Commande  : npx vitest run bank_api.integration.test.js
 * ============================================================
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import pg from 'pg';

const { Pool } = pg;

// ── Connexion à la base de TEST ────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/bank_test';
const pool = new Pool({ connectionString: DATABASE_URL });

// ── Initialisation du schéma ───────────────────────────────────
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id          SERIAL PRIMARY KEY,
      first_name  TEXT NOT NULL,
      last_name   TEXT NOT NULL,
      email       TEXT UNIQUE NOT NULL,
      balance     NUMERIC(18,2) NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      status      TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id               SERIAL PRIMARY KEY,
      account_id       INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      amount           NUMERIC(18,2) NOT NULL,
      operation        TEXT NOT NULL,
      date             TIMESTAMPTZ NOT NULL DEFAULT now(),
      previous_balance NUMERIC(18,2),
      new_balance      NUMERIC(18,2)
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
  `);
}

// ── Nettoyage entre chaque test ────────────────────────────────
async function clearDb() {
  await pool.query('TRUNCATE TABLE transactions, accounts RESTART IDENTITY CASCADE');
}

// ── Helpers de mapping ─────────────────────────────────────────
function mapAccount(row) {
  return {
    id:        row.id,
    firstName: row.first_name,
    lastName:  row.last_name,
    email:     row.email,
    balance:   Number(row.balance),
    createdAt: row.created_at.toISOString(),
    status:    row.status
  };
}

function mapTransaction(row) {
  return {
    id:              row.id,
    accountId:       row.account_id,
    amount:          Number(row.amount),
    operation:       row.operation,
    date:            row.date.toISOString(),
    previousBalance: row.previous_balance !== null ? Number(row.previous_balance) : null,
    newBalance:      row.new_balance      !== null ? Number(row.new_balance)      : null
  };
}

// ── Construction de l'app avec la vraie DB ─────────────────────
function createApp() {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // POST /accounts
  app.post('/accounts', async (req, res) => {
    try {
      const { firstName, lastName, email } = req.body;
      if (!firstName || !lastName || !email)
        return res.status(400).json({ error: 'Les champs firstName, lastName et email sont obligatoires', status: 400 });
      if (!validateEmail(email))
        return res.status(400).json({ error: 'Email invalide', status: 400 });

      const result = await pool.query(
        'INSERT INTO accounts (first_name, last_name, email) VALUES ($1, $2, $3) RETURNING *',
        [firstName, lastName, email]
      );
      res.status(201).json(mapAccount(result.rows[0]));
    } catch (err) {
      if (err.code === '23505') // unique violation
        return res.status(400).json({ error: 'Cet email est déjà utilisé', status: 400 });
      res.status(500).json({ error: 'Erreur serveur', status: 500 });
    }
  });

  // GET /accounts
  app.get('/accounts', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM accounts ORDER BY id');
      res.json(result.rows.map(mapAccount));
    } catch {
      res.status(500).json({ error: 'Erreur serveur', status: 500 });
    }
  });

  // GET /accounts/:accountId
  app.get('/accounts/:accountId', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM accounts WHERE id = $1', [req.params.accountId]);
      if (!result.rows.length)
        return res.status(404).json({ error: 'Compte non trouvé', status: 404 });
      res.json(mapAccount(result.rows[0]));
    } catch {
      res.status(500).json({ error: 'Erreur serveur', status: 500 });
    }
  });

  // POST /transactions
  app.post('/transactions', async (req, res) => {
    const client = await pool.connect();
    try {
      const { accountId, amount, operation } = req.body;
      if (!accountId || amount === undefined || !operation)
        return res.status(400).json({ error: 'Les champs accountId, amount et operation sont obligatoires', status: 400 });
      if (typeof amount !== 'number' || amount <= 0)
        return res.status(400).json({ error: 'Le montant doit être un nombre positif', status: 400 });
      if (!['deposit', 'withdraw'].includes(operation))
        return res.status(400).json({ error: 'L\'opération doit être "deposit" ou "withdraw"', status: 400 });

      await client.query('BEGIN');

      const accResult = await client.query(
        'SELECT * FROM accounts WHERE id = $1 FOR UPDATE',
        [accountId]
      );
      if (!accResult.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Compte non trouvé', status: 404 });
      }

      const account         = accResult.rows[0];
      const previousBalance = Number(account.balance);

      if (operation === 'withdraw' && previousBalance < amount) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Fonds insuffisants. Solde disponible: ' + previousBalance, status: 400 });
      }

      const newBalance = operation === 'deposit'
        ? previousBalance + amount
        : previousBalance - amount;

      await client.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newBalance, accountId]);

      const txResult = await client.query(
        `INSERT INTO transactions (account_id, amount, operation, previous_balance, new_balance)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [accountId, amount, operation, previousBalance, newBalance]
      );

      await client.query('COMMIT');
      res.status(200).json(mapTransaction(txResult.rows[0]));
    } catch {
      await client.query('ROLLBACK');
      res.status(500).json({ error: 'Erreur serveur', status: 500 });
    } finally {
      client.release();
    }
  });

  // GET /history/:accountId
  app.get('/history/:accountId', async (req, res) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const accResult = await pool.query('SELECT id FROM accounts WHERE id = $1', [accountId]);
      if (!accResult.rows.length)
        return res.status(404).json({ error: 'Compte non trouvé', status: 404 });

      const result = await pool.query(
        'SELECT * FROM transactions WHERE account_id = $1 ORDER BY date ASC',
        [accountId]
      );
      res.json(result.rows.map(mapTransaction));
    } catch {
      res.status(500).json({ error: 'Erreur serveur', status: 500 });
    }
  });

  app.use((req, res) => res.status(404).json({ error: 'Endpoint non trouvé', status: 404 }));

  return app;
}

// =============================================================
//  SETUP GLOBAL
// =============================================================
let app;

beforeAll(async () => {
  await initDb();
  app = createApp();
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await clearDb();
});

// =============================================================
//  SUITE 1 — POST /accounts
// =============================================================
describe('POST /accounts — Création de compte (DB)', () => {

  test('✅ Crée un compte et le persiste en base', async () => {
    const res = await request(app).post('/accounts').send({ firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com' });
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com', balance: 0, status: 'active' });
    expect(res.body.id).toBeTypeOf('number');
    expect(res.body.createdAt).toBeDefined();

    // Vérification directe en base
    const row = await pool.query('SELECT * FROM accounts WHERE email = $1', ['jean@example.com']);
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].first_name).toBe('Jean');
  });

  test('✅ Les ids sont auto-incrémentés par PostgreSQL', async () => {
    const r1 = await request(app).post('/accounts').send({ firstName: 'A', lastName: 'A', email: 'a@a.com' });
    const r2 = await request(app).post('/accounts').send({ firstName: 'B', lastName: 'B', email: 'b@b.com' });
    expect(r2.body.id).toBeGreaterThan(r1.body.id);
  });

  test('❌ Refuse un email dupliqué (contrainte UNIQUE PostgreSQL)', async () => {
    await request(app).post('/accounts').send({ firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com' });
    const res = await request(app).post('/accounts').send({ firstName: 'Marie', lastName: 'Curie', email: 'jean@example.com' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/déjà utilisé/i);

    // Vérification : un seul enregistrement en base
    const row = await pool.query('SELECT COUNT(*) FROM accounts WHERE email = $1', ['jean@example.com']);
    expect(Number(row.rows[0].count)).toBe(1);
  });

  test('❌ Refuse si firstName manquant', async () => {
    const res = await request(app).post('/accounts').send({ lastName: 'Dupont', email: 'x@x.com' });
    expect(res.statusCode).toBe(400);
  });

  test('❌ Refuse un email invalide', async () => {
    const res = await request(app).post('/accounts').send({ firstName: 'Jean', lastName: 'Dupont', email: 'pas-un-email' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/email invalide/i);
  });

  test('✅ Le solde initial stocké en base est 0', async () => {
    await request(app).post('/accounts').send({ firstName: 'Jean', lastName: 'Dupont', email: 'j@d.com' });
    const row = await pool.query('SELECT balance FROM accounts WHERE email = $1', ['j@d.com']);
    expect(Number(row.rows[0].balance)).toBe(0);
  });
});

// =============================================================
//  SUITE 2 — GET /accounts
// =============================================================
describe('GET /accounts — Liste (DB)', () => {

  test('✅ Retourne un tableau vide si aucun compte en base', async () => {
    const res = await request(app).get('/accounts');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('✅ Retourne tous les comptes persistés', async () => {
    await request(app).post('/accounts').send({ firstName: 'A', lastName: 'A', email: 'a@a.com' });
    await request(app).post('/accounts').send({ firstName: 'B', lastName: 'B', email: 'b@b.com' });
    const res = await request(app).get('/accounts');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});

// =============================================================
//  SUITE 3 — GET /accounts/:accountId
// =============================================================
describe("GET /accounts/:id — Détail (DB)", () => {

  test('✅ Retourne le bon compte depuis la base', async () => {
    const created = await request(app).post('/accounts').send({ firstName: 'Jean', lastName: 'Dupont', email: 'j@d.com' });
    const res = await request(app).get(`/accounts/${created.body.id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBe('j@d.com');
  });

  test("❌ Retourne 404 si l'id n'existe pas en base", async () => {
    const res = await request(app).get('/accounts/99999');
    expect(res.statusCode).toBe(404);
  });
});

// =============================================================
//  SUITE 4 — POST /transactions  (avec transactions SQL atomiques)
// =============================================================
describe('POST /transactions — Dépôt & Retrait (DB)', () => {

  let accountId;

  beforeEach(async () => {
    const res = await request(app).post('/accounts').send({ firstName: 'Jean', lastName: 'Dupont', email: 'j@d.com' });
    accountId = res.body.id;
  });

  test('✅ Le dépôt est persisté en base', async () => {
    await request(app).post('/transactions').send({ accountId, amount: 500, operation: 'deposit' });

    const acc = await pool.query('SELECT balance FROM accounts WHERE id = $1', [accountId]);
    expect(Number(acc.rows[0].balance)).toBe(500);

    const tx = await pool.query('SELECT * FROM transactions WHERE account_id = $1', [accountId]);
    expect(tx.rows).toHaveLength(1);
    expect(tx.rows[0].operation).toBe('deposit');
    expect(Number(tx.rows[0].amount)).toBe(500);
    expect(Number(tx.rows[0].previous_balance)).toBe(0);
    expect(Number(tx.rows[0].new_balance)).toBe(500);
  });

  test('✅ Plusieurs dépôts accumulent le solde correctement en base', async () => {
    await request(app).post('/transactions').send({ accountId, amount: 300, operation: 'deposit' });
    await request(app).post('/transactions').send({ accountId, amount: 200, operation: 'deposit' });
    const acc = await pool.query('SELECT balance FROM accounts WHERE id = $1', [accountId]);
    expect(Number(acc.rows[0].balance)).toBe(500);
  });

  test('✅ Le retrait met à jour le solde en base', async () => {
    await request(app).post('/transactions').send({ accountId, amount: 1000, operation: 'deposit' });
    await request(app).post('/transactions').send({ accountId, amount: 400,  operation: 'withdraw' });
    const acc = await pool.query('SELECT balance FROM accounts WHERE id = $1', [accountId]);
    expect(Number(acc.rows[0].balance)).toBe(600);
  });

  test('✅ La transaction SQL est atomique — rollback si erreur', async () => {
    // Retrait refusé = aucune transaction enregistrée, solde inchangé
    await request(app).post('/transactions').send({ accountId, amount: 100, operation: 'deposit' });
    await request(app).post('/transactions').send({ accountId, amount: 500, operation: 'withdraw' }); // refusé

    const acc = await pool.query('SELECT balance FROM accounts WHERE id = $1', [accountId]);
    expect(Number(acc.rows[0].balance)).toBe(100);

    const tx = await pool.query('SELECT COUNT(*) FROM transactions WHERE account_id = $1', [accountId]);
    expect(Number(tx.rows[0].count)).toBe(1); // seul le dépôt est enregistré
  });

  test('❌ Fonds insuffisants — solde et transactions inchangés en base', async () => {
    const res = await request(app).post('/transactions').send({ accountId, amount: 999, operation: 'withdraw' });
    expect(res.statusCode).toBe(400);

    const acc = await pool.query('SELECT balance FROM accounts WHERE id = $1', [accountId]);
    expect(Number(acc.rows[0].balance)).toBe(0);

    const tx = await pool.query('SELECT COUNT(*) FROM transactions WHERE account_id = $1', [accountId]);
    expect(Number(tx.rows[0].count)).toBe(0);
  });

  test('❌ Montant invalide (0) — aucune écriture en base', async () => {
    const res = await request(app).post('/transactions').send({ accountId, amount: 0, operation: 'deposit' });
    expect(res.statusCode).toBe(400);
    const tx = await pool.query('SELECT COUNT(*) FROM transactions WHERE account_id = $1', [accountId]);
    expect(Number(tx.rows[0].count)).toBe(0);
  });

  test('❌ Compte inexistant — 404 et aucune écriture', async () => {
    const res = await request(app).post('/transactions').send({ accountId: 99999, amount: 100, operation: 'deposit' });
    expect(res.statusCode).toBe(404);
    const tx = await pool.query('SELECT COUNT(*) FROM transactions', []);
    expect(Number(tx.rows[0].count)).toBe(0);
  });
});

// =============================================================
//  SUITE 5 — GET /history/:accountId
// =============================================================
describe("GET /history/:accountId — Historique (DB)", () => {

  let accountId;

  beforeEach(async () => {
    const res = await request(app).post('/accounts').send({ firstName: 'Jean', lastName: 'Dupont', email: 'j@d.com' });
    accountId = res.body.id;
  });

  test('✅ Retourne un tableau vide si aucune transaction en base', async () => {
    const res = await request(app).get(`/history/${accountId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('✅ Retourne les transactions dans le bon ordre chronologique', async () => {
    await request(app).post('/transactions').send({ accountId, amount: 100, operation: 'deposit' });
    await request(app).post('/transactions').send({ accountId, amount: 50,  operation: 'withdraw' });
    const res = await request(app).get(`/history/${accountId}`);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].operation).toBe('deposit');
    expect(res.body[1].operation).toBe('withdraw');
  });

  test("✅ L'historique est filtré par account_id en base", async () => {
    const r2  = await request(app).post('/accounts').send({ firstName: 'Marie', lastName: 'Curie', email: 'm@c.com' });
    const id2 = r2.body.id;
    await request(app).post('/transactions').send({ accountId,  amount: 100, operation: 'deposit' });
    await request(app).post('/transactions').send({ accountId: id2, amount: 200, operation: 'deposit' });

    const hist1 = await request(app).get(`/history/${accountId}`);
    const hist2 = await request(app).get(`/history/${id2}`);
    expect(hist1.body).toHaveLength(1);
    expect(hist2.body).toHaveLength(1);
    expect(hist1.body[0].amount).toBe(100);
    expect(hist2.body[0].amount).toBe(200);
  });

  test("❌ Retourne 404 si le compte n'existe pas en base", async () => {
    const res = await request(app).get('/history/99999');
    expect(res.statusCode).toBe(404);
  });

  test('✅ Les champs previousBalance et newBalance sont corrects', async () => {
    await request(app).post('/transactions').send({ accountId, amount: 400, operation: 'deposit' });
    await request(app).post('/transactions').send({ accountId, amount: 150, operation: 'withdraw' });
    const res = await request(app).get(`/history/${accountId}`);
    expect(res.body[0].previousBalance).toBe(0);
    expect(res.body[0].newBalance).toBe(400);
    expect(res.body[1].previousBalance).toBe(400);
    expect(res.body[1].newBalance).toBe(250);
  });
});
