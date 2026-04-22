const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
app.use(express.json());

let accounts = [];
let transactions = [];
let accountIdCounter = 1;

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

// --- LOGIQUE METIER COMPLÈTE ET PROFESSIONNELLE ---

// Validation helper
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// 1. CRÉER UN COMPTE
app.post('/accounts', (req, res) => {
  try {
    const { firstName, lastName, email } = req.body;

    // Validation des données
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

    // Vérifier si l'email existe déjà
    if (accounts.some(a => a.email === email)) {
      return res.status(400).json({ 
        error: 'Cet email est déjà utilisé',
        status: 400
      });
    }

    const newAccount = {
      id: accountIdCounter++,
      firstName,
      lastName,
      email,
      balance: 0,
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    accounts.push(newAccount);
    res.status(201).json(newAccount);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur', status: 500 });
  }
});

// 2. LISTER TOUS LES COMPTES
app.get('/accounts', (req, res) => {
  try {
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur', status: 500 });
  }
});

// 3. RÉCUPÉRER LES DÉTAILS D'UN COMPTE
app.get('/accounts/:accountId', (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    const account = accounts.find(a => a.id === accountId);

    if (!account) {
      return res.status(404).json({ 
        error: 'Compte non trouvé',
        status: 404
      });
    }

    res.json(account);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur', status: 500 });
  }
});

// 4. EFFECTUER UNE TRANSACTION (DÉPÔT OU RETRAIT)
app.post('/transactions', (req, res) => {
  try {
    const { accountId, amount, operation } = req.body;

    // Validation
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

    const account = accounts.find(a => a.id === parseInt(accountId));

    if (!account) {
      return res.status(404).json({ 
        error: 'Compte non trouvé',
        status: 404
      });
    }

    // Vérifier les fonds pour un retrait
    if (operation === 'withdraw' && account.balance < amount) {
      return res.status(400).json({ 
        error: 'Fonds insuffisants. Solde disponible: ' + account.balance,
        status: 400
      });
    }

    // Effectuer la transaction
    const previousBalance = account.balance;
    account.balance += (operation === 'deposit' ? amount : -amount);

    const transaction = {
      id: transactions.length + 1,
      accountId,
      amount,
      operation,
      date: new Date().toISOString(),
      previousBalance,
      newBalance: account.balance
    };

    transactions.push(transaction);

    res.status(200).json(transaction);
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur', status: 500 });
  }
});

// 5. RÉCUPÉRER L'HISTORIQUE DES TRANSACTIONS
app.get('/history/:accountId', (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);

    // Vérifier que le compte existe
    const account = accounts.find(a => a.id === accountId);
    if (!account) {
      return res.status(404).json({ 
        error: 'Compte non trouvé',
        status: 404
      });
    }

    const history = transactions.filter(t => t.accountId === accountId);
    res.json(history);
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
app.listen(PORT, () => {
  console.log(`🚀 Serveur Bank API lancé sur http://localhost:${PORT}`);
  console.log(`📚 Documentation Swagger: http://localhost:${PORT}/api-docs`);
});