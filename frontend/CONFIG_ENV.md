# Configuration du fichier .env pour le frontend

## URL de l'API

Votre API backend est disponible à : `https://api.devbattlearena.webatif.fr` (HTTPS)

## Créer le fichier .env

Créez un fichier `.env` dans le dossier `frontend/` avec le contenu suivant :

```env
VITE_API_URL=https://api.devbattlearena.webatif.fr
```

**Important :** Utiliser HTTPS car le frontend et le backend sont en HTTPS.

## Instructions

### Windows (PowerShell)
```powershell
cd frontend
echo VITE_API_URL=https://api.devbattlearena.webatif.fr > .env
```

### Windows (CMD)
```cmd
cd frontend
echo VITE_API_URL=https://api.devbattlearena.webatif.fr > .env
```

### Linux/Mac
```bash
cd frontend
echo "VITE_API_URL=https://api.devbattlearena.webatif.fr" > .env
```

## Important : Rebuild après modification

Après avoir créé/modifié le fichier `.env`, vous DEVEZ rebuilder le frontend :

```bash
cd frontend
npm run build
```

Le fichier `.env` est lu au moment du build, pas à l'exécution.

## Vérification

Après le build, ouvrez la console du navigateur (F12) et vous devriez voir :
```
🔧 Configuration API: https://api.devbattlearena.webatif.fr
🔧 Configuration Socket: https://api.devbattlearena.webatif.fr
```

## ✅ Configuration HTTPS

Le frontend et le backend sont en HTTPS. La configuration est optimale pour :
- ✅ Pas d'erreur Mixed Content
- ✅ Connexions sécurisées
- ✅ Compatible avec les navigateurs modernes

