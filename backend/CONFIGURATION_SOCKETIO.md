# Configuration WebSocket/Socket.IO pour la Production

## ✅ Modifications effectuées

La configuration Socket.IO a été améliorée pour fonctionner en production, notamment sur cPanel.

## 🔧 Configuration Backend

### Améliorations apportées :

1. **Transports multiples** : `websocket` et `polling` (fallback automatique)
2. **Timeout augmenté** : 60 secondes pour les connexions lentes
3. **Support des proxies** : Configuration optimisée pour les reverse proxies
4. **CORS configurable** : Via variable d'environnement `FRONTEND_URL`

### Variables d'environnement (optionnel)

Dans votre fichier `backend/.env`, vous pouvez ajouter :

```env
FRONTEND_URL=https://votre-domaine-frontend.com
```

Cela restreint les connexions Socket.IO à votre domaine frontend uniquement.

## 🔧 Configuration Frontend

### Améliorations apportées :

1. **Reconnexion automatique** : Si la connexion est perdue
2. **Transports multiples** : Essaie WebSocket puis polling automatiquement
3. **Timeout configuré** : 20 secondes pour la connexion initiale

## ⚠️ Problèmes potentiels sur cPanel

### Problème 1 : Reverse Proxy bloque WebSocket

**Symptôme** : Connexion Socket.IO échoue, erreur dans la console

**Solution** : 
- Socket.IO va automatiquement fallback sur `polling` si WebSocket ne fonctionne pas
- Le polling fonctionne même derrière un reverse proxy

### Problème 2 : Port différent pour Socket.IO

**Symptôme** : Connexion réussit mais les événements ne fonctionnent pas

**Solution** : Assurez-vous que `SOCKET_URL` dans `frontend/src/config/api.js` pointe vers le même port que votre backend

### Problème 3 : CORS Error

**Symptôme** : Erreur CORS dans la console du navigateur

**Solution** : 
- Vérifiez que `FRONTEND_URL` dans le backend correspond à votre domaine frontend
- Ou laissez `origin: "*"` pour accepter toutes les origines (moins sécurisé mais fonctionne)

## 🧪 Test de la connexion WebSocket

### Test 1 : Vérifier dans la console

1. Ouvrez votre application frontend
2. Appuyez sur **F12** pour ouvrir les outils de développement
3. Allez dans l'onglet **"Console"**
4. Vous devriez voir des messages comme :
   - `✅ Connexion Socket.IO établie`
   - `Utilisateur connecté: [socket_id]`

### Test 2 : Vérifier le transport utilisé

Dans la console, vous devriez voir :
- `transport: websocket` (idéal)
- OU `transport: polling` (fonctionne aussi, mais moins performant)

### Test 3 : Tester la reconnexion

1. Déconnectez votre connexion internet
2. Attendez quelques secondes
3. Reconnectez-vous
4. Socket.IO devrait automatiquement se reconnecter

## 📋 Checklist de déploiement

- [ ] Backend démarré sur cPanel
- [ ] Variable `FRONTEND_URL` configurée (optionnel)
- [ ] Frontend configuré avec la bonne `SOCKET_URL`
- [ ] Console du navigateur ne montre pas d'erreurs Socket.IO
- [ ] Transport utilisé : `websocket` ou `polling` (les deux fonctionnent)
- [ ] Reconnexion automatique testée

## 🔍 Debugging

### Voir les logs Socket.IO côté serveur

Dans les logs Node.js de cPanel, vous devriez voir :
```
Utilisateur connecté: [socket_id]
Total utilisateurs connectés: [nombre]
```

### Voir les logs côté client

Dans la console du navigateur :
- `🔧 Configuration Socket: [URL]` - URL utilisée
- Messages de connexion/déconnexion Socket.IO

### Activer les logs détaillés Socket.IO (développement)

Dans `frontend/src/pages/GamePage.jsx` et `AdminPage.jsx`, vous pouvez ajouter :

```javascript
socket.on('connect', () => {
  console.log('✅ Socket.IO connecté, transport:', socket.io.engine.transport.name);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Socket.IO déconnecté:', reason);
});

socket.on('connect_error', (error) => {
  console.error('❌ Erreur de connexion Socket.IO:', error);
});
```

## 💡 Notes importantes

1. **Polling fonctionne toujours** : Même si WebSocket ne fonctionne pas, le polling (long-polling HTTP) fonctionne derrière n'importe quel proxy
2. **Performance** : WebSocket est plus performant que polling, mais les deux fonctionnent
3. **Reconnexion automatique** : Socket.IO se reconnecte automatiquement en cas de perte de connexion
4. **Timeout** : Les timeouts sont configurés pour gérer les connexions lentes

## 🚀 En production

Socket.IO devrait fonctionner automatiquement en production car :
- ✅ Fallback automatique sur polling si WebSocket échoue
- ✅ Reconnexion automatique
- ✅ Configuration optimisée pour les proxies
- ✅ Timeouts adaptés aux connexions lentes

Si vous avez des problèmes, vérifiez les logs dans la console du navigateur et les logs Node.js sur cPanel.

