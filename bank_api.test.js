/**
 * ============================================================
 *  BANK API — Scripts de tests complets
 *  Outil : Vitest + Supertest
 *  Installation : npm install --save-dev vitest supertest
 *  Commande    : npx vitest run bank_api.test.js
 * ============================================================
 */

import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ── Reproduction minimale de l'app pour les tests ─────────────
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

  let accounts         = [];
  let transactions     = [];
  let accountIdCounter = 1;

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // POST /accounts
  app.post('/accounts', (req, res) => {
    const { firstName, lastName, email } = req.body;
    if (!firstName || !lastName || !email)
      return res.status(400).json({ error: 'Les champs firstName, lastName et email sont obligatoires', status: 400 });
    if (!validateEmail(email))
      return res.status(400).json({ error: 'Email invalide', status: 400 });
    if (accounts.some(a => a.email === email))
      return res.status(400).json({ error: 'Cet email est déjà utilisé', status: 400 });
    const newAccount = { id: accountIdCounter++, firstName, lastName, email, balance: 0, createdAt: new Date().toISOString(), status: 'active' };
    accounts.push(newAccount);
    res.status(201).json(newAccount);
  });

  // GET /accounts
  app.get('/accounts', (req, res) => res.json(accounts));

  // GET /accounts/:accountId
  app.get('/accounts/:accountId', (req, res) => {
    const account = accounts.find(a => a.id === parseInt(req.params.accountId));
    if (!account) return res.status(404).json({ error: 'Compte non trouvé', status: 404 });
    res.json(account);
  });

  // POST /transactions
  app.post('/transactions', (req, res) => {
    const { accountId, amount, operation } = req.body;
    if (!accountId || amount === undefined || !operation)
      return res.status(400).json({ error: 'Les champs accountId, amount et operation sont obligatoires', status: 400 });
    if (typeof amount !== 'number' || amount <= 0)
      return res.status(400).json({ error: 'Le montant doit être un nombre positif', status: 400 });
    if (!['deposit', 'withdraw'].includes(operation))
      return res.status(400).json({ error: 'L\'opération doit être "deposit" ou "withdraw"', status: 400 });
    const account = accounts.find(a => a.id === parseInt(accountId));
    if (!account) return res.status(404).json({ error: 'Compte non trouvé', status: 404 });
    if (operation === 'withdraw' && account.balance < amount)
      return res.status(400).json({ error: 'Fonds insuffisants. Solde disponible: ' + account.balance, status: 400 });
    const previousBalance = account.balance;
    account.balance += (operation === 'deposit' ? amount : -amount);
    const transaction = { id: transactions.length + 1, accountId, amount, operation, date: new Date().toISOString(), previousBalance, newBalance: account.balance };
    transactions.push(transaction);
    res.status(200).json(transaction);
  });

  // GET /history/:accountId
  app.get('/history/:accountId', (req, res) => {
    const accountId = parseInt(req.params.accountId);
    const account = accounts.find(a => a.id === accountId);
    if (!account) return res.status(404).json({ error: 'Compte non trouvé', status: 404 });
    res.json(transactions.filter(t => t.accountId === accountId));
  });

  app.use((req, res) => res.status(404).json({ error: 'Endpoint non trouvé', status: 404 }));

  return app;
}

// =============================================================
//  SUITE 1 — POST /accounts  (Création de compte)
// =============================================================
describe('POST /accounts — Création de compte', () => {
  let app;
  beforeEach(() => { app = createApp(); });

  test('✅ Crée un compte avec des données valides', async () => {
    const res = await request(app).post('/accounts').send({ firstName: 'Jean', lastName: 'Dupont', email: 'jean.dupont@example.com' });
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ id: 1, firstName: 'Jean', lastName: 'Dupont', email: 'jean.dupont@example.com', balance: 0, status: 'active' });
    expect(res.body.createdAt).toBeDefined();
  });

  test('✅ Assigne un id auto-incrémenté à chaque compte', async () => {
    await request(app).post('/accounts').send({ firstName: 'A', lastName: 'A', email: 'a@a.com' });
    const res = await request(app).post('/accounts').send({ firstName: 'B', lastName: 'B', email: 'b@b.com' });
    expect(res.body.id).toBe(2);
  });

  test('❌ Refuse si firstName est manquant', async () => {
    const res = await request(app).post('/accounts').send({ lastName: 'Dupont', email: 'x@x.com' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/obligatoires/i);
  });

  test('❌ Refuse si lastName est manquant', async () => {
    const res = await request(app).post('/accounts').send({ firstName: 'Jean', email: 'x@x.com' });
    expect(res.statusCode).toBe(400);
  });

  test('❌ Refuse si email est manquant', async () => {
    const res = await request(app).post('/accounts').send({ firstName: 'Jean', lastName: 'Dupont' });
    expect(res.statusCode).toBe(400);
  });

  test('❌ Refuse si le body est vide', async () => {
    const res = await request(app).post('/accounts').send({});
    expect(res.statusCode).toBe(400);
  });

  test('❌ Refuse un email au format invalide', async () => {
    const res = await request(app).post('/accounts').send({ firstName: 'Jean', lastName: 'Dupont', email: 'pas-un-email' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/email invalide/i);
  });

  test('❌ Refuse un email sans domaine', async () => {
    const res = await request(app).post('/accounts').send({ firstName: 'Jean', lastName: 'Dupont', email: 'jean@' });
    expect(res.statusCode).toBe(400);
  });

  test('❌ Refuse un email déjà utilisé', async () => {
    await request(app).post('/accounts').send({ firstName: 'Jean', lastName: 'Dupont', email: 'jean@example.com' });
    const res = await request(app).post('/accounts').send({ firstName: 'Marie', lastName: 'Curie', email: 'jean@example.com' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/déjà utilisé/i);
  });

  test('✅ Le solde initial est toujours 0', async () => {
    const res = await request(app).post('/accounts').send({ firstName: 'Jean', lastName: 'Dupont', email: 'j@d.com' });
    expect(res.body.balance).toBe(0);
  });

  test('✅ Le statut initial est "active"', async () => {
    const res = await request(app).post('/accounts').send({ firstName: 'Jean', lastName: 'Dupont', email: 'j@d.com' });
    expect(res.body.status).toBe('active');
  });
});

// =============================================================
//  SUITE 2 — GET /accounts  (Liste des comptes)
// =============================================================
describe('GET /accounts — Liste des comptes', () => {
  let app;
  beforeEach(() => { app = createApp(); });

  test('✅ Retourne un tableau vide si aucun compte', async () => {
    const res = await request(app).get('/accounts');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('✅ Retourne tous les comptes créés', async () => {
    await request(app).post('/accounts').send({ firstName: 'A', lastName: 'A', email: 'a@a.com' });
    await request(app).post('/accounts').send({ firstName: 'B', lastName: 'B', email: 'b@b.com' });
    const res = await request(app).get('/accounts');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('✅ Les données retournées contiennent les bons champs', async () => {
    await request(app).post('/accounts').send({ firstName: 'Jean', lastName: 'Dupont', email: 'j@d.com' });
    const res = await request(app).get('/accounts');
    const acc = res.body[0];
    expect(acc).toHaveProperty('id');
    expect(acc).toHaveProperty('firstName');
    expect(acc).toHaveProperty('lastName');
    expect(acc).toHaveProperty('email');
    expect(acc).toHaveProperty('balance');
    expect(acc).toHaveProperty('status');
    expect(acc).toHaveProperty('createdAt');
  });
});

// =============================================================
//  SUITE 3 — GET /accounts/:accountId  (Détail d'un compte)
// =============================================================
describe("GET /accounts/:accountId — Détail d'un compte", () => {
  let app;
  beforeEach(() => { app = createApp(); });

  test('✅ Retourne le bon compte par id', async () => {
    await request(app).post('/accounts').send({ firstName: 'Jean', lastName: 'Dupont', email: 'j@d.com' });
    const res = await request(app).get('/accounts/1');
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(1);
    expect(res.body.email).toBe('j@d.com');
  });

  test('✅ Distingue correctement deux comptes différents', async () => {
    await request(app).post('/accounts').send({ firstName: 'A', lastName: 'A', email: 'a@a.com' });
    await request(app).post('/accounts').send({ firstName: 'B', lastName: 'B', email: 'b@b.com' });
    const res = await request(app).get('/accounts/2');
    expect(res.body.email).toBe('b@b.com');
  });

  test("❌ Retourne 404 si le compte n'existe pas", async () => {
    const res = await request(app).get('/accounts/999');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/non trouvé/i);
  });

  test('❌ Retourne 404 pour un id négatif', async () => {
    const res = await request(app).get('/accounts/-1');
    expect(res.statusCode).toBe(404);
  });
});

// =============================================================
//  SUITE 4 — POST /transactions  (Dépôt & Retrait)
// =============================================================
describe('POST /transactions — Dépôt & Retrait', () => {
  let app;
  let accountId;

  beforeEach(async () => {
    app = createApp();
    const res = await request(app).post('/accounts').send({ firstName: 'Jean', lastName: 'Dupont', email: 'j@d.com' });
    accountId = res.body.id;
  });

  // --- Dépôts ---
  test('✅ Effectue un dépôt avec succès', async () => {
    const res = await request(app).post('/transactions').send({ accountId, amount: 500, operation: 'deposit' });
    expect(res.statusCode).toBe(200);
    expect(res.body.operation).toBe('deposit');
    expect(res.body.amount).toBe(500);
    expect(res.body.newBalance).toBe(500);
    expect(res.body.previousBalance).toBe(0);
  });

  test('✅ Le solde du compte est bien mis à jour après un dépôt', async () => {
    await request(app).post('/transactions').send({ accountId, amount: 1000, operation: 'deposit' });
    const account = await request(app).get(`/accounts/${accountId}`);
    expect(account.body.balance).toBe(1000);
  });

  test("✅ Plusieurs dépôts s'accumulent correctement", async () => {
    await request(app).post('/transactions').send({ accountId, amount: 200, operation: 'deposit' });
    await request(app).post('/transactions').send({ accountId, amount: 300, operation: 'deposit' });
    const account = await request(app).get(`/accounts/${accountId}`);
    expect(account.body.balance).toBe(500);
  });

  // --- Retraits ---
  test('✅ Effectue un retrait avec succès', async () => {
    await request(app).post('/transactions').send({ accountId, amount: 1000, operation: 'deposit' });
    const res = await request(app).post('/transactions').send({ accountId, amount: 400, operation: 'withdraw' });
    expect(res.statusCode).toBe(200);
    expect(res.body.newBalance).toBe(600);
    expect(res.body.previousBalance).toBe(1000);
  });

  test('✅ Le solde est exact après dépôt puis retrait', async () => {
    await request(app).post('/transactions').send({ accountId, amount: 800, operation: 'deposit' });
    await request(app).post('/transactions').send({ accountId, amount: 300, operation: 'withdraw' });
    const account = await request(app).get(`/accounts/${accountId}`);
    expect(account.body.balance).toBe(500);
  });

  test('✅ Retrait qui vide exactement le compte (solde = 0)', async () => {
    await request(app).post('/transactions').send({ accountId, amount: 200, operation: 'deposit' });
    const res = await request(app).post('/transactions').send({ accountId, amount: 200, operation: 'withdraw' });
    expect(res.statusCode).toBe(200);
    expect(res.body.newBalance).toBe(0);
  });

  // --- Fonds insuffisants ---
  test('❌ Refuse un retrait si fonds insuffisants', async () => {
    const res = await request(app).post('/transactions').send({ accountId, amount: 100, operation: 'withdraw' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/fonds insuffisants/i);
  });

  test('❌ Refuse un retrait supérieur au solde', async () => {
    await request(app).post('/transactions').send({ accountId, amount: 300, operation: 'deposit' });
    const res = await request(app).post('/transactions').send({ accountId, amount: 400, operation: 'withdraw' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('300');
  });

  test('❌ Le solde ne change pas après un retrait refusé', async () => {
    await request(app).post('/transactions').send({ accountId, amount: 100, operation: 'deposit' });
    await request(app).post('/transactions').send({ accountId, amount: 500, operation: 'withdraw' });
    const account = await request(app).get(`/accounts/${accountId}`);
    expect(account.body.balance).toBe(100);
  });

  // --- Validations des champs ---
  test('❌ Refuse si accountId est manquant', async () => {
    const res = await request(app).post('/transactions').send({ amount: 100, operation: 'deposit' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/obligatoires/i);
  });

  test('❌ Refuse si amount est manquant', async () => {
    const res = await request(app).post('/transactions').send({ accountId, operation: 'deposit' });
    expect(res.statusCode).toBe(400);
  });

  test('❌ Refuse si operation est manquante', async () => {
    const res = await request(app).post('/transactions').send({ accountId, amount: 100 });
    expect(res.statusCode).toBe(400);
  });

  test('❌ Refuse si le montant est 0', async () => {
    const res = await request(app).post('/transactions').send({ accountId, amount: 0, operation: 'deposit' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/positif/i);
  });

  test('❌ Refuse si le montant est négatif', async () => {
    const res = await request(app).post('/transactions').send({ accountId, amount: -50, operation: 'deposit' });
    expect(res.statusCode).toBe(400);
  });

  test('❌ Refuse si le montant est une chaîne', async () => {
    const res = await request(app).post('/transactions').send({ accountId, amount: 'cent', operation: 'deposit' });
    expect(res.statusCode).toBe(400);
  });

  test('❌ Refuse une opération inconnue', async () => {
    const res = await request(app).post('/transactions').send({ accountId, amount: 100, operation: 'transfer' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/deposit.*withdraw/i);
  });

  test("❌ Retourne 404 si le compte n'existe pas", async () => {
    const res = await request(app).post('/transactions').send({ accountId: 999, amount: 100, operation: 'deposit' });
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/non trouvé/i);
  });

  // --- Structure de la réponse ---
  test('✅ La réponse contient tous les champs attendus', async () => {
    const res = await request(app).post('/transactions').send({ accountId, amount: 100, operation: 'deposit' });
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('accountId');
    expect(res.body).toHaveProperty('amount');
    expect(res.body).toHaveProperty('operation');
    expect(res.body).toHaveProperty('date');
    expect(res.body).toHaveProperty('previousBalance');
    expect(res.body).toHaveProperty('newBalance');
  });
});

// =============================================================
//  SUITE 5 — GET /history/:accountId  (Historique)
// =============================================================
describe("GET /history/:accountId — Historique des transactions", () => {
  let app;
  let accountId;

  beforeEach(async () => {
    app = createApp();
    const res = await request(app).post('/accounts').send({ firstName: 'Jean', lastName: 'Dupont', email: 'j@d.com' });
    accountId = res.body.id;
  });

  test('✅ Retourne un tableau vide si aucune transaction', async () => {
    const res = await request(app).get(`/history/${accountId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('✅ Retourne toutes les transactions du compte', async () => {
    await request(app).post('/transactions').send({ accountId, amount: 100, operation: 'deposit' });
    await request(app).post('/transactions').send({ accountId, amount: 50,  operation: 'deposit' });
    const res = await request(app).get(`/history/${accountId}`);
    expect(res.body).toHaveLength(2);
  });

  test("✅ L'historique est correctement filtré par compte", async () => {
    const res2 = await request(app).post('/accounts').send({ firstName: 'Marie', lastName: 'Curie', email: 'm@c.com' });
    const accountId2 = res2.body.id;
    await request(app).post('/transactions').send({ accountId,  amount: 100, operation: 'deposit' });
    await request(app).post('/transactions').send({ accountId: accountId2, amount: 200, operation: 'deposit' });
    const hist1 = await request(app).get(`/history/${accountId}`);
    const hist2 = await request(app).get(`/history/${accountId2}`);
    expect(hist1.body).toHaveLength(1);
    expect(hist2.body).toHaveLength(1);
    expect(hist1.body[0].amount).toBe(100);
    expect(hist2.body[0].amount).toBe(200);
  });

  test('✅ Les champs de chaque transaction sont corrects', async () => {
    await request(app).post('/transactions').send({ accountId, amount: 250, operation: 'deposit' });
    const res = await request(app).get(`/history/${accountId}`);
    const t = res.body[0];
    expect(t).toHaveProperty('id');
    expect(t).toHaveProperty('accountId', accountId);
    expect(t).toHaveProperty('amount', 250);
    expect(t).toHaveProperty('operation', 'deposit');
    expect(t).toHaveProperty('date');
    expect(t).toHaveProperty('previousBalance', 0);
    expect(t).toHaveProperty('newBalance', 250);
  });

  test("✅ L'ordre des transactions est chronologique", async () => {
    await request(app).post('/transactions').send({ accountId, amount: 100, operation: 'deposit' });
    await request(app).post('/transactions').send({ accountId, amount: 200, operation: 'deposit' });
    const res = await request(app).get(`/history/${accountId}`);
    expect(res.body[0].amount).toBe(100);
    expect(res.body[1].amount).toBe(200);
  });

  test("❌ Retourne 404 si le compte n'existe pas", async () => {
    const res = await request(app).get('/history/999');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/non trouvé/i);
  });
});

// =============================================================
//  SUITE 6 — Routes non trouvées
// =============================================================
describe('Routes non trouvées — 404 générique', () => {
  let app;
  beforeEach(() => { app = createApp(); });

  test('❌ Retourne 404 pour une route inconnue', async () => {
    const res = await request(app).get('/unknown-route');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toMatch(/non trouvé/i);
  });

  test('❌ Retourne 404 pour une méthode non gérée', async () => {
    const res = await request(app).delete('/accounts');
    expect(res.statusCode).toBe(404);
  });
});

// =============================================================
//  SUITE 7 — Headers CORS
// =============================================================
describe('CORS — Headers de sécurité', () => {
  let app;
  beforeEach(() => { app = createApp(); });

  test('✅ Répond 200 à une requête OPTIONS (preflight)', async () => {
    const res = await request(app).options('/accounts');
    expect(res.statusCode).toBe(200);
  });

  test('✅ Le header Access-Control-Allow-Origin est présent', async () => {
    const res = await request(app).get('/accounts');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});
