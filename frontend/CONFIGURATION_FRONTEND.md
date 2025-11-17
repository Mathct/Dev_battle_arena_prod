# Configuration du Frontend pour la Production

## ✅ Modifications effectuées

Toutes les URLs codées en dur (`http://localhost:3000`) ont été remplacées par une configuration centralisée dans `src/config/api.js`.

## 🔧 Configuration

### Option 1 : Fichier .env (RECOMMANDÉ)

Créez un fichier `.env` dans le dossier `frontend/` avec :

```env
VITE_API_URL=https://votre-domaine.com:PORT
```

**Exemple :**
```env
VITE_API_URL=https://mondomaine.com:3000
```

**OU si votre backend est sur un sous-domaine :**
```env
VITE_API_URL=https://api.mondomaine.com
```

### Option 2 : Configuration automatique

Si vous ne créez pas de fichier `.env`, le système utilisera automatiquement :
- **En développement** : `http://localhost:3000`
- **En production** : `https://votre-domaine.com:3000` (même domaine que le frontend)

## 📝 Étapes pour configurer

### 1. Créer le fichier .env

Dans le dossier `frontend/`, créez un fichier `.env` :

```bash
# Windows
cd frontend
echo VITE_API_URL=https://votre-domaine.com:PORT > .env

# Linux/Mac
cd frontend
echo "VITE_API_URL=https://votre-domaine.com:PORT" > .env
```

### 2. Déterminer l'URL de votre backend

Sur cPanel, votre backend Node.js peut être :
- Sur le même domaine avec un port : `https://mondomaine.com:3000`
- Sur un sous-domaine : `https://api.mondomaine.com`
- Sur un chemin : `https://mondomaine.com/api`

**Comment trouver l'URL de votre backend :**
1. Dans cPanel, allez dans **"Node.js Apps"** ou **"Setup Node.js App"**
2. Cliquez sur votre application backend
3. Vous verrez l'URL de votre application (ex: `https://mondomaine.com:3000`)

### 3. Rebuild le frontend

Après avoir créé/modifié le fichier `.env`, vous devez rebuilder le frontend :

```bash
cd frontend
npm run build
```

Le fichier `.env` est lu au moment du build, pas à l'exécution.

### 4. Vérifier la configuration

Ouvrez la console du navigateur (F12) et vous devriez voir :
```
🔧 Configuration API: https://votre-domaine.com:3000
```

## 🔍 Vérification

### Test 1 : Vérifier que l'API est accessible

Ouvrez votre navigateur et allez à :
```
https://votre-domaine.com/api/debug/db
```

Si vous voyez une réponse JSON, l'API est accessible.

### Test 2 : Vérifier dans la console

1. Ouvrez votre application frontend
2. Appuyez sur **F12** pour ouvrir les outils de développement
3. Allez dans l'onglet **"Console"**
4. Vous devriez voir : `🔧 Configuration API: [URL]`
5. Si vous voyez des erreurs de connexion, vérifiez que l'URL est correcte

## ⚠️ Problèmes courants

### Problème 1 : CORS Error

Si vous voyez une erreur CORS dans la console :
- Vérifiez que le backend autorise les requêtes depuis votre domaine
- Le backend doit avoir `cors()` configuré (déjà fait dans votre code)

### Problème 2 : Connection Refused

Si vous voyez "Connection Refused" :
- Vérifiez que l'URL dans `.env` est correcte
- Vérifiez que le backend est démarré sur cPanel
- Vérifiez que le port est correct

### Problème 3 : L'URL ne change pas après le rebuild

- Supprimez le dossier `frontend/dist/`
- Rebuild : `npm run build`
- Redéployez le dossier `dist/` sur cPanel

## 📋 Checklist

- [ ] Fichier `.env` créé dans `frontend/`
- [ ] `VITE_API_URL` défini avec l'URL correcte de votre backend
- [ ] Frontend rebuild avec `npm run build`
- [ ] Frontend redéployé sur cPanel
- [ ] Console du navigateur affiche la bonne URL
- [ ] Test de connexion à l'API réussi

## 💡 Note importante

**Vite** (le bundler utilisé) préfixe les variables d'environnement avec `VITE_` pour des raisons de sécurité. Seules les variables commençant par `VITE_` sont accessibles dans le code frontend.

