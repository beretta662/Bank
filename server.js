const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// CORS pour le frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Postgres connection (use DATABASE_URL or defaults)
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/bank';
const pool = new Pool({ connectionString: DATABASE_URL });

// Initialize DB schema if needed
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

// Configuration Swagger CORRECTE avec schémas complets
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bank API - Système Bancaire Professionnel',
      version: '1.0.0',
      description: 'API de gestion bancaire complète avec dépôts, retraits et historique'
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Serveur local' }
    ],
    components: {
      schemas: {
        Account: {
          type: 'object',
          required: ['firstName', 'lastName', 'email'],
          properties: {
            id: { type: 'integer', example: 1 },
            firstName: { type: 'string', example: 'Jean' },
            lastName: { type: 'string', example: 'Dupont' },
            email: { type: 'string', format: 'email', example: 'jean@example.com' },
            balance: { type: 'number', example: 0, default: 0 },
            createdAt: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['active', 'inactive'], default: 'active' }
          }
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            accountId: { type: 'integer' },
            amount: { type: 'number' },
            operation: { type: 'string', enum: ['deposit', 'withdraw'] },
            date: { type: 'string', format: 'date-time' },
            newBalance: { type: 'number' }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            status: { type: 'integer' }
          }
        }
      }
    },
    paths: {
      '/accounts': {
        post: {
          summary: 'Créer un nouveau compte bancaire',
          tags: ['Comptes'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['firstName', 'lastName', 'email'],
                  properties: {
                    firstName: { type: 'string', example: 'Jean' },
                    lastName: { type: 'string', example: 'Dupont' },
                    email: { type: 'string', format: 'email', example: 'jean@example.com' }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Compte créé avec succès',
              content: {
                'application/json': {
                  schema: { '$ref': '#/components/schemas/Account' }
                }
              }
            },
            '400': {
              description: 'Données invalides ou email déjà utilisé',
              content: {
                'application/json': {
                  schema: { '$ref': '#/components/schemas/ErrorResponse' }
                }
              }
            }
          }
        },
        get: {
          summary: 'Lister tous les comptes',
          tags: ['Comptes'],
          responses: {
            '200': {
              description: 'Liste des comptes',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { '$ref': '#/components/schemas/Account' }
                  }
                }
              }
            }
          }
        }
      },
      '/accounts/{accountId}': {
        get: {
          summary: 'Récupérer les détails d\'un compte',
          tags: ['Comptes'],
          parameters: [
            {
              name: 'accountId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              example: 1
            }
          ],
          responses: {
            '200': {
              description: 'Détails du compte',
              content: {
                'application/json': {
                  schema: { '$ref': '#/components/schemas/Account' }
                }
              }
            },
            '404': {
              description: 'Compte non trouvé',
              content: {
                'application/json': {
                  schema: { '$ref': '#/components/schemas/ErrorResponse' }
                }
              }
            }
          }
        }
      },
      '/transactions': {
        post: {
          summary: 'Effectuer un dépôt ou un retrait',
          tags: ['Transactions'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['accountId', 'amount', 'operation'],
                  properties: {
                    accountId: { type: 'integer', example: 1 },
                    amount: { type: 'number', example: 100, minimum: 0.01 },
                    operation: { type: 'string', enum: ['deposit', 'withdraw'], example: 'deposit' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Transaction réussie',
              content: {
                'application/json': {
                  schema: { '$ref': '#/components/schemas/Transaction' }
                }
              }
            },
            '400': {
              description: 'Fonds insuffisants ou montant invalide',
              content: {
                'application/json': {
                  schema: { '$ref': '#/components/schemas/ErrorResponse' }
                }
              }
            },
            '404': {
              description: 'Compte non trouvé',
              content: {
                'application/json': {
                  schema: { '$ref': '#/components/schemas/ErrorResponse' }
                }
              }
            }
          }
        }
      },
      '/history/{accountId}': {
        get: {
          summary: 'Récupérer l\'historique des transactions',
          tags: ['Transactions'],
          parameters: [
            {
              name: 'accountId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              example: 1
            }
          ],
          responses: {
            '200': {
              description: 'Historique des transactions',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { '$ref': '#/components/schemas/Transaction' }
                  }
                }
              }
            },
            '404': {
              description: 'Compte non trouvé',
              content: {
                'application/json': {
                  schema: { '$ref': '#/components/schemas/ErrorResponse' }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: []
};
const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
app.get('/', (req, res) => res.redirect('/api-docs'));

// --- LOGIQUE METIER COMPLÈTE ET PROFESSIONNELLE (PostgreSQL) ---

// Validation helper
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

function mapAccount(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    balance: Number(row.balance),
    createdAt: row.created_at.toISOString(),
    status: row.status
  };
}

function mapTransaction(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    amount: Number(row.amount),
    operation: row.operation,
    date: row.date.toISOString(),
    previousBalance: row.previous_balance !== null ? Number(row.previous_balance) : null,
    newBalance: row.new_balance !== null ? Number(row.new_balance) : null
  };
}

// 1. CRÉER UN COMPTE
app.post('/accounts', async (req, res) => {
  try {
    const { firstName, lastName, email } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        error: 'Les champs firstName, lastName et email sont obligatoires',
        status: 400
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        error: 'Email invalide',
        status: 400
      });
    }

    const result = await pool.query(
      'INSERT INTO accounts (first_name, last_name, email) VALUES ($1, $2, $3) RETURNING *',
      [firstName, lastName, email]
    );

    res.status(201).json(mapAccount(result.rows[0]));
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        error: 'Cet email est déjà utilisé',
        status: 400
      });
    }
    res.status(500).json({ error: 'Erreur serveur', status: 500 });
  }
});

// 2. LISTER TOUS LES COMPTES
app.get('/accounts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM accounts ORDER BY id');
    res.json(result.rows.map(mapAccount));
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur', status: 500 });
  }
});

// 3. RÉCUPÉRER LES DÉTAILS D'UN COMPTE
app.get('/accounts/:accountId', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM accounts WHERE id = $1', [req.params.accountId]);

    if (!result.rows.length) {
      return res.status(404).json({
        error: 'Compte non trouvé',
        status: 404
      });
    }

    res.json(mapAccount(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur', status: 500 });
  }
});

// 4. EFFECTUER UNE TRANSACTION (DÉPÔT OU RETRAIT)
app.post('/transactions', async (req, res) => {
  const client = await pool.connect();
  try {
    const { accountId, amount, operation } = req.body;

    if (!accountId || amount === undefined || !operation) {
      return res.status(400).json({
        error: 'Les champs accountId, amount et operation sont obligatoires',
        status: 400
      });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        error: 'Le montant doit être un nombre positif',
        status: 400
      });
    }

    if (!['deposit', 'withdraw'].includes(operation)) {
      return res.status(400).json({
        error: 'L\'opération doit être "deposit" ou "withdraw"',
        status: 400
      });
    }

    await client.query('BEGIN');

    const accResult = await client.query(
      'SELECT * FROM accounts WHERE id = $1 FOR UPDATE',
      [accountId]
    );

    if (!accResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Compte non trouvé',
        status: 404
      });
    }

    const account = accResult.rows[0];
    const previousBalance = Number(account.balance);

    if (operation === 'withdraw' && previousBalance < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Fonds insuffisants. Solde disponible: ' + previousBalance,
        status: 400
      });
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
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Erreur serveur', status: 500 });
  } finally {
    client.release();
  }
});

// 5. RÉCUPÉRER L'HISTORIQUE DES TRANSACTIONS
app.get('/history/:accountId', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);

    const accResult = await pool.query('SELECT id FROM accounts WHERE id = $1', [accountId]);
    if (!accResult.rows.length) {
      return res.status(404).json({
        error: 'Compte non trouvé',
        status: 404
      });
    }

    const result = await pool.query(
      'SELECT * FROM transactions WHERE account_id = $1 ORDER BY date ASC',
      [accountId]
    );

    res.json(result.rows.map(mapTransaction));
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur', status: 500 });
  }
});

// Route 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint non trouvé',
    status: 404
  });
});

const PORT = process.env.PORT || 3000;

// Ne démarre le serveur HTTP que si ce fichier est exécuté directement
// (node server.js). Quand il est importé par les tests via require('./server'),
// app.listen() n'est jamais appelé : on récupère juste l'app Express exportée.
if (require.main === module) {
  initDb()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`🚀 Serveur Bank API lancé sur http://localhost:${PORT}`);
        console.log(`📚 Documentation Swagger: http://localhost:${PORT}/api-docs`);
      });
    })
    .catch((err) => {
      console.error('❌ Erreur lors de l\'initialisation de la base de données :', err);
      process.exit(1);
    });
}

module.exports = app;
module.exports.pool = pool;
module.exports.initDb = initDb;