# Résolution de l'erreur WebSocket

## ❌ Erreur rencontrée

```
WebSocket connection to 'ws://api.devbattlearena.webatif.fr/socket.io/?EIO=4&transport=websocket' failed: 
One or more reserved bits are on: reserved1 = 0, reserved2 = 1, reserved3 = 1
```

## 🔍 Cause

Cette erreur indique qu'un **reverse proxy** (cPanel/nginx/apache) modifie incorrectement les en-têtes WebSocket, ce qui corrompt les données.

## ✅ Solution appliquée

La configuration a été modifiée pour :
1. **Utiliser polling en premier** au lieu de WebSocket
2. **Permettre l'upgrade vers WebSocket** si le polling fonctionne bien
3. **Fallback automatique** si WebSocket échoue

### Modifications

**Frontend :**
- `transports: ['polling', 'websocket']` - Polling en premier
- Socket.IO essaiera WebSocket après avoir établi une connexion polling

**Backend :**
- `transports: ['polling', 'websocket']` - Permet les deux transports
- Configuration optimisée pour les proxies

## 🧪 Test

Après le déploiement, vérifiez dans la console du navigateur :

1. **Connexion réussie** :
   ```
   ✅ Socket.IO connecté, transport: polling
   ```

2. **Pas d'erreur WebSocket** - L'erreur devrait disparaître

3. **Fonctionnalité** - Les événements Socket.IO devraient fonctionner normalement

## 💡 Pourquoi ça fonctionne

- **Polling (long-polling HTTP)** fonctionne derrière n'importe quel proxy
- **Pas de modification des en-têtes** par le proxy
- **Performance** : Légèrement moins rapide que WebSocket, mais fonctionne partout
- **Socket.IO** peut upgrader vers WebSocket si les conditions sont bonnes

## 🔄 Alternative : Forcer seulement polling

Si vous voulez forcer uniquement le polling (sans tentative WebSocket), modifiez dans `GamePage.jsx` et `AdminPage.jsx` :

```javascript
const socket = io(SOCKET_URL, {
  transports: ['polling'], // Polling uniquement
  // ... reste de la config
});
```

## 📝 Note

Le polling fonctionne très bien pour la plupart des applications. La différence de performance avec WebSocket est généralement négligeable pour votre cas d'usage.

