// Configuration de l'URL de l'API backend
// En développement, utilise localhost
// En production, utilise l'URL du serveur

const getApiUrl = () => {
  // Option 1 : Utiliser une variable d'environnement Vite (RECOMMANDÉ)
  // Créez un fichier .env dans frontend/ avec : VITE_API_URL=https://api.devbattlearena.webatif.fr
  if (import.meta.env.VITE_API_URL) {
    // Normaliser l'URL (enlever le slash final si présent)
    let url = import.meta.env.VITE_API_URL;
    url = url.endsWith('/') ? url.slice(0, -1) : url;
    
    // Si le frontend est en HTTPS mais l'API est en HTTP, forcer HTTPS
    if (window.location.protocol === 'https:' && url.startsWith('http://')) {
      console.warn('⚠️ Frontend en HTTPS mais API en HTTP - conversion automatique en HTTPS');
      url = url.replace('http://', 'https://');
    }
    
    return url;
  }
  
  // Si on est en développement (localhost)
  if (import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }
  
  // En production : dériver l'URL du backend depuis l'URL actuelle
  const protocol = window.location.protocol; // Utilise le protocole du frontend (https ou http)
  const hostname = window.location.hostname;
  
  // Si votre backend est sur un sous-domaine (ex: api.mondomaine.com)
  // Détecter automatiquement si c'est un sous-domaine API
  if (hostname.includes('devbattlearena')) {
    // Utiliser le sous-domaine API avec le même protocole que le frontend
    return `${protocol}//api.devbattlearena.webatif.fr`;
  }
  
  // Sinon, utiliser le même domaine avec un port
  return `${protocol}//${hostname}:3000`;
};

export const API_URL = getApiUrl();
export const SOCKET_URL = getApiUrl();

console.log('🔧 Configuration API:', API_URL);
console.log('🔧 Configuration Socket:', SOCKET_URL);
