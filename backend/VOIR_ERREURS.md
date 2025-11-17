# Comment voir les erreurs sur cPanel et dans le navigateur

## 🔍 Méthode 1 : Via le navigateur (Recommandé)

### Tester la connexion à la base de données

Ouvrez votre navigateur et allez à :
```
https://votre-domaine.com/api/debug/db
```

Ou si votre backend est sur un port spécifique :
```
https://votre-domaine.com:PORT/api/debug/db
```

Cette route vous affichera :
- ✅ Si la connexion fonctionne
- ❌ Les erreurs de connexion avec le code d'erreur
- 📋 Les paramètres de connexion utilisés (host, port, user, database)

**Exemple de réponse en cas de succès :**
```json
{
  "success": true,
  "message": "Connexion OK",
  "config": {
    "host": "localhost",
    "port": 3306,
    "user": "votrenom_user",
    "database": "votrenom_db",
    "password": "***"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Exemple de réponse en cas d'erreur :**
```json
{
  "success": false,
  "message": "Access denied for user...",
  "code": "ER_ACCESS_DENIED_ERROR",
  "config": {
    "host": "localhost",
    "port": 3306,
    "user": "root",
    "database": "dev_battle_arena_db"
  }
}
```

### Tester la santé du serveur

```
https://votre-domaine.com/api/health
```

## 📋 Méthode 2 : Via les logs cPanel

### Étape 1 : Accéder aux logs

1. Connectez-vous à votre **cPanel**
2. Dans la section **"Logs"** ou **"Metrics"**, trouvez :
   - **"Raw Access Logs"** ou **"Error Logs"**
   - **"Node.js Application Logs"** (si vous avez une application Node.js configurée)

### Étape 2 : Voir les logs Node.js

Si vous avez une application Node.js configurée dans cPanel :

1. Allez dans **"Node.js Apps"** ou **"Setup Node.js App"**
2. Cliquez sur votre application
3. Cliquez sur **"View Logs"** ou **"Logs"**
4. Vous verrez tous les `console.log()` et `console.error()` de votre application

### Étape 3 : Voir les logs d'erreur généraux

1. Dans cPanel, allez dans **"Error Log"** ou **"Errors"**
2. Les erreurs récentes seront affichées
3. Recherchez les erreurs avec "MySQL" ou "Database" dans le message

## 🔧 Méthode 3 : Via SSH (si disponible)

Si vous avez accès SSH :

```bash
# Aller dans le dossier de votre application
cd ~/votre-dossier-backend

# Voir les logs en temps réel
tail -f logs/app.log

# Ou si les logs sont dans stdout/stderr
pm2 logs
```

## 📱 Méthode 4 : Via la console du navigateur

1. Ouvrez votre application frontend
2. Appuyez sur **F12** pour ouvrir les outils de développement
3. Allez dans l'onglet **"Console"**
4. Les erreurs de connexion API seront affichées ici

## 🐛 Interpréter les codes d'erreur MySQL

### ER_ACCESS_DENIED_ERROR
- **Problème** : Nom d'utilisateur ou mot de passe incorrect
- **Solution** : Vérifiez `DB_USER` et `DB_PASSWORD` dans votre `.env`

### ER_BAD_DB_ERROR
- **Problème** : Base de données n'existe pas ou nom incorrect
- **Solution** : Vérifiez `DB_NAME` dans votre `.env` (doit être le nom COMPLET avec préfixe cPanel)

### ECONNREFUSED
- **Problème** : MySQL n'est pas démarré ou host/port incorrect
- **Solution** : Vérifiez `DB_HOST` (généralement "localhost") et `DB_PORT` (généralement 3306)

### PROTOCOL_CONNECTION_LOST
- **Problème** : Connexion perdue pendant l'exécution
- **Solution** : Le système devrait se reconnecter automatiquement

## ✅ Checklist de dépannage

1. ✅ Vérifiez que votre fichier `.env` existe dans `backend/.env`
2. ✅ Vérifiez les valeurs dans `.env` (nom d'utilisateur complet avec préfixe cPanel)
3. ✅ Testez la connexion via `/api/debug/db`
4. ✅ Vérifiez les logs cPanel pour les erreurs détaillées
5. ✅ Vérifiez que MySQL est actif dans cPanel

## 💡 Astuce

Pour voir les erreurs en temps réel pendant le développement, ajoutez dans votre `.env` :
```env
NODE_ENV=development
```

Cela permettra d'afficher plus de détails d'erreur dans les réponses API.

