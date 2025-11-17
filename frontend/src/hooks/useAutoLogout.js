import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

const useAutoLogout = (timeoutMinutes = 30, warningMinutes = 5) => {
  const navigate = useNavigate();
  const timeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const isWarningShownRef = useRef(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState(warningMinutes * 60);

  const resetTimer = () => {
    // Nettoyer les timers existants
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    
    isWarningShownRef.current = false;
    setShowWarning(false);
    setWarningCountdown(warningMinutes * 60);

    // Timer d'avertissement (5 minutes avant déconnexion)
    const warningTime = (timeoutMinutes - warningMinutes) * 60 * 1000;
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true);
      setWarningCountdown(warningMinutes * 60);
    }, warningTime);

    // Timer de déconnexion
    const logoutTime = timeoutMinutes * 60 * 1000;
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, logoutTime);
  };

  const handleStayConnected = () => {
    setShowWarning(false);
    resetTimer();
  };

  const handleLogoutNow = () => {
    handleLogout();
  };

  const handleLogout = () => {
    // Nettoyer le localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('gameState');
    
    // Rediriger vers la page d'accueil
    navigate('/');
    
    // Recharger la page pour nettoyer l'état
    window.location.reload();
  };

  const clearTimers = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    isWarningShownRef.current = false;
    setShowWarning(false);
  };

  useEffect(() => {
    // Événements qui indiquent une activité
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    // Fonction pour reset le timer
    const handleActivity = () => {
      resetTimer();
    };

    // Ajouter les listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Initialiser le timer
    resetTimer();

    // Nettoyage
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      clearTimers();
    };
  }, [timeoutMinutes, warningMinutes]);

  return {
    resetTimer,
    clearTimers,
    showWarning,
    warningCountdown,
    handleStayConnected,
    handleLogoutNow
  };
};

export default useAutoLogout;
