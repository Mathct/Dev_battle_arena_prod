import { useNavigate } from "react-router";
import { useEffect } from "react";
import "./Header.css";

function Header({ user, onLogout, onReturnHome, isConnected, buzzerNotification, buzzerControl, countdown }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      // Fallback si pas de fonction fournie
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('gameState');
      navigate('/');
    }
  };

  const handleReturnHome = () => {
    if (onReturnHome) {
      onReturnHome();
    } else {
      navigate('/');
    }
  };

   // Déclencher automatiquement le stop quand le chrono atteint 0
  useEffect(() => {
    if (buzzerControl && 
        buzzerControl.countdown <= 0 && 
        buzzerControl.enabled === true &&
        buzzerControl.onToggle) {
      // Appeler onToggle pour arrêter le chrono (comme si l'admin avait cliqué sur STOP)
      buzzerControl.onToggle();
    }
  }, [buzzerControl]);

  return (
    <header className="game-header">
      <div className="header-left">
        <img 
          src="/logo.png" 
          alt="DEV BATTLE ARENA" 
          className="header-logo"
          onClick={handleReturnHome}
        />
      </div>
      
      {/* Notification de buzzer au centre */}
      {buzzerNotification && (
        <div className="buzzer-notification">
          <span className="buzzer-notification-text">
            🔔 {buzzerNotification.name} a buzzé !
          </span>
        </div>
      )}
      
      {/* Chrono pour les utilisateurs */}
      {countdown > 0 && !buzzerControl && (
        <div className="user-countdown-display">
          <span className="user-countdown-text">
            {countdown.toFixed(2)}
          </span>
        </div>
      )}
      
      
      
      {/* Contrôle buzzer pour l'admin au centre */}
      {buzzerControl && buzzerControl.gameState === 1 && !buzzerControl.buzzedPlayer && (
        <div className="admin-buzzer-control">
          <button 
            onClick={buzzerControl.onToggle} 
            className={`admin-buzzer-btn ${buzzerControl.enabled ? 'enabled' : 'disabled'}`}
          >
            {buzzerControl.enabled ? 'STOP' : 'GO CHRONO'}
          </button>
        </div>
      )}

      {/* Overlay plein écran du chrono pour l'admin */}
      {buzzerControl && buzzerControl.gameState === 1 && !buzzerControl.buzzedPlayer && buzzerControl.enabled && buzzerControl.countdown > 0 && (
        <div className="admin-countdown-overlay" aria-hidden="true">
          <div className="admin-countdown-overlay-inner">
            <span className="admin-countdown-text">
              {buzzerControl.countdown.toFixed(2)}
            </span>
          </div>
        </div>
      )}
      
      <div className="header-right">
        <div className="header-controls">
          <div className="connection-status">
            <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '🟢 SERVEUR ACTIF' : '🔴 SERVEUR HORS LIGNE'}
            </span>
          </div>
          
          {user && (
            <div className="user-section">
              <span className="user-name">{user.username}</span>
              <button onClick={handleLogout} className="header-btn logout-btn">
                DÉCONNEXION
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
