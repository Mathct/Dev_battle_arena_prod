import { useState, useEffect } from 'react';
import './AutoLogoutWarning.css';

function AutoLogoutWarning({ isVisible, onConfirm, onCancel, remainingTime }) {
  const [countdown, setCountdown] = useState(remainingTime);

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onConfirm(); // Déconnexion automatique
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, onConfirm]);

  if (!isVisible) return null;

  return (
    <div className="auto-logout-overlay">
      <div className="auto-logout-modal">
        <div className="warning-icon">⚠️</div>
        <h2>Déconnexion automatique</h2>
        <p>
          Vous serez déconnecté dans <strong>{countdown} secondes</strong> 
          en raison de l'inactivité.
        </p>
        <div className="warning-actions">
          <button 
            onClick={onCancel}
            className="stay-connected-btn"
          >
            Rester connecté
          </button>
          <button 
            onClick={onConfirm}
            className="logout-now-btn"
          >
            Se déconnecter maintenant
          </button>
        </div>
        <div className="countdown-bar">
          <div 
            className="countdown-progress" 
            style={{ width: `${(countdown / remainingTime) * 100}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

export default AutoLogoutWarning;
