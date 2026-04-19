const express = require('express');
const app = express();
app.use(express.json());

// Base de données en mémoire (sera réinitialisée à chaque redémarrage sur Render)
let comptes = [];

// 1. CRÉER UN COMPTE
app.post('/api/comptes', (req, res) => {
    const { titulaire, solde_initial } = req.body;
    const nouveau = { 
        id: Math.floor(1000 + Math.random() * 9000), 
        titulaire, 
        solde: solde_initial || 0 
    };
    comptes.push(nouveau);
    res.status(201).json(nouveau);
});

// 2. LISTER LES COMPTES (Consigne obligatoire 🚨)
app.get('/api/comptes', (req, res) => {
    res.json(comptes);
});

// 3. TRANSACTIONS (Dépôts / Retraits)
app.post('/api/transaction', (req, res) => {
    const { id, montant, type } = req.body;
    const compte = comptes.find(c => c.id == id);

    if (!compte) return res.status(404).json({ erreur: "Compte introuvable" });

    if (type === 'retrait') {
        if (compte.solde < montant) return res.status(400).json({ erreur: "Fonds insuffisants" });
        compte.solde -= montant;
    } else {
        compte.solde += montant;
    }
    res.json({ message: "Succès", nouveauSolde: compte.solde });
});

// Port dynamique pour le Cloud
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur Bank démarré sur le port ${PORT}`));