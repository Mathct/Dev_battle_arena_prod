# Résolution du problème "Page introuvable" au refresh

## ❌ Problème

Quand vous rafraîchissez la page sur une route comme `/game`, vous voyez d'abord "Page introuvable" (404) puis la page se charge.

## 🔍 Cause

C'est un problème classique avec les Single Page Applications (SPA) React :

1. Vous accédez à `https://devbattlearena.webatif.fr/game`
2. Le serveur web (Apache) cherche un fichier physique `/game` qui n'existe pas
3. Le serveur retourne une 404
4. React Router charge ensuite et affiche la bonne page

## ✅ Solution

J'ai créé un fichier `.htaccess` dans `frontend/public/` qui sera automatiquement copié dans `dist/` lors du build.

Ce fichier configure Apache pour :
- Rediriger toutes les routes vers `index.html`
- Laisser React Router gérer le routage côté client

## 📝 Étapes

### 1. Rebuild le frontend

Le fichier `.htaccess` dans `public/` sera copié dans `dist/` lors du build :

```bash
cd frontend
npm run build
```

### 2. Vérifier que le fichier est dans dist/

Après le build, vérifiez que `frontend/dist/.htaccess` existe.

### 3. Redéployer

Redéployez le dossier `dist/` sur cPanel, en vous assurant que le fichier `.htaccess` est inclus.

## 🧪 Test

Après le déploiement :

1. Allez sur `https://devbattlearena.webatif.fr/game`
2. Rafraîchissez la page (F5)
3. ✅ La page devrait se charger directement sans voir "Page introuvable"

## 🔧 Si ça ne fonctionne pas

### Vérifier que .htaccess est déployé

1. Vérifiez dans cPanel que le fichier `.htaccess` est bien dans le dossier public_html (ou le dossier de votre site)
2. Assurez-vous que le fichier n'est pas ignoré lors du déploiement

### Vérifier que mod_rewrite est activé

Le fichier `.htaccess` nécessite le module `mod_rewrite` d'Apache. Sur cPanel, il est généralement activé par défaut.

### Alternative : Créer directement sur le serveur

Si le fichier n'est pas copié automatiquement, créez-le directement dans cPanel :

1. Allez dans **File Manager** dans cPanel
2. Naviguez vers le dossier de votre site (public_html ou le dossier du domaine)
3. Créez un nouveau fichier `.htaccess`
4. Copiez le contenu du fichier `frontend/public/.htaccess`

## 📋 Contenu du fichier .htaccess

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # Ne pas réécrire les fichiers existants
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  
  # Rediriger toutes les routes vers index.html pour React Router
  RewriteRule . /index.html [L]
</IfModule>
```

## ✅ Après la correction

- ✅ Plus de "Page introuvable" au refresh
- ✅ Toutes les routes fonctionnent directement
- ✅ Les liens directs vers `/game`, `/admin`, etc. fonctionnent
- ✅ Le rafraîchissement fonctionne sur toutes les pages

