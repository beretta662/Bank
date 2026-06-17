# Bank Frontend

Frontend minimal (React + Vite) pour l'API Bank.

Prérequis:
- Node.js 18+ et npm

Installer et lancer en développement:

```bash
cd bank-frontend
npm install
npm run dev
```

L'application attend le backend sur `http://localhost:3000` (Swagger disponible sur `/api-docs`).

Construire et servir (local):

```bash
npm run build
npm run preview
```

Docker (build + run):

```bash
docker build -t bank-frontend:latest .
docker run -p 5173:80 bank-frontend:latest
```

Tests manuels recommandés:
- Créer un compte via le formulaire
- Vérifier la liste des comptes mise à jour
- Effectuer un dépôt puis retrait via le formulaire de transaction
- Vérifier l'historique via `GET /history/{accountId}` (Swagger ou curl)

Accéder au frontend
- **URL locale:** http://localhost:8000
- Si vous servez les fichiers statiques depuis `bank-frontend` avec Python:

```bash
cd bank-frontend
python3 -m http.server 8000
```

- Si vous utilisez le serveur Vite (si installé):

```bash
cd bank-frontend
npm install
npm run dev
```

Le frontend communique avec l'API sur `http://localhost:3000` (Swagger: `/api-docs`).

```frontend  http://localhost:8000 