# Correction de l'erreur Mixed Content (HTTPS)

## ❌ Erreur rencontrée

```
Mixed Content: The page at 'https://...' was loaded over HTTPS, but requested an insecure XMLHttpRequest endpoint 'http://...'. 
This request has been blocked; the content must be served over HTTPS.
```

## 🔍 Cause

Le frontend est chargé en **HTTPS** mais l'API backend utilise **HTTP**. Les navigateurs modernes bloquent les requêtes HTTP depuis une page HTTPS pour des raisons de sécurité.

## ✅ Solution appliquée

La configuration a été améliorée pour :
1. **Détecter automatiquement** si le frontend est en HTTPS
2. **Convertir automatiquement** l'URL de l'API en HTTPS si nécessaire
3. **Utiliser le même protocole** que le frontend

## 🔧 Configuration requise

### Option 1 : Mettre à jour le fichier .env (RECOMMANDÉ)

Modifiez votre fichier `.env` dans `frontend/` pour utiliser HTTPS :

```env
VITE_API_URL=https://api.devbattlearena.webatif.fr
```

**Important :** Remplacez `http://` par `https://`

### Option 2 : Laisser la détection automatique

Si vous ne modifiez pas le `.env`, le code détectera automatiquement que le frontend est en HTTPS et convertira l'URL de l'API en HTTPS.

## 📝 Étapes

### 1. Vérifier si votre API supporte HTTPS

Testez dans votre navigateur :
```
https://api.devbattlearena.webatif.fr
```

Si vous voyez une réponse JSON, l'API supporte HTTPS ✅

Si vous voyez une erreur de certificat ou de connexion, vous devrez :
- Configurer SSL/HTTPS pour votre sous-domaine API dans cPanel
- Ou utiliser un certificat Let's Encrypt

### 2. Mettre à jour le fichier .env

Dans `frontend/.env`, changez :
```env
# AVANT (HTTP)
VITE_API_URL=http://api.devbattlearena.webatif.fr

# APRÈS (HTTPS)
VITE_API_URL=https://api.devbattlearena.webatif.fr
```

### 3. Rebuild le frontend

```bash
cd frontend
npm run build
```

### 4. Redéployer

Redéployez le dossier `dist/` sur cPanel.

## 🧪 Vérification

Après le déploiement, ouvrez la console du navigateur (F12) :

1. **Plus d'erreur Mixed Content** ✅
2. **Configuration API affiche HTTPS** :
   ```
   🔧 Configuration API: https://api.devbattlearena.webatif.fr
   ```
3. **Les requêtes fonctionnent** ✅

## ⚠️ Si l'API ne supporte pas HTTPS

Si votre API ne supporte pas HTTPS, vous avez deux options :

### Option A : Configurer SSL pour l'API (RECOMMANDÉ)

Dans cPanel :
1. Allez dans **"SSL/TLS"**
2. Installez un certificat SSL pour `api.devbattlearena.webatif.fr`
3. Utilisez Let's Encrypt (gratuit) si disponible

### Option B : Forcer HTTP (non recommandé, moins sécurisé)

Si vraiment nécessaire, vous pouvez forcer HTTP dans le code, mais ce n'est pas recommandé pour la production.

## 💡 Note importante

Le code détecte maintenant automatiquement le protocole du frontend. Si le frontend est en HTTPS, il utilisera automatiquement HTTPS pour l'API, même si vous avez mis HTTP dans le `.env`.

## ✅ Résumé

- **Cause** : Frontend en HTTPS, API en HTTP
- **Solution** : Utiliser HTTPS pour l'API
- **Action** : Mettre à jour `.env` avec `https://` et rebuild

