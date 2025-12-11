import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import io from "socket.io-client";
import useAutoLogout from "../hooks/useAutoLogout";
import AutoLogoutWarning from "../components/AutoLogoutWarning";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "./GamePage.css";
import { API_URL, SOCKET_URL } from "../config/api";

// Configuration Socket.IO pour la production
// Forcer polling uniquement (WebSocket ne fonctionne pas avec le reverse proxy cPanel)
const socket = io(SOCKET_URL, {
  transports: ['polling'], // Polling uniquement - WebSocket échoue avec le reverse proxy
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
  timeout: 20000,
  // Désactiver l'upgrade vers WebSocket
  upgrade: false,
  rememberUpgrade: false,
});

function GamePage() {
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [buzzedPlayer, setBuzzedPlayer] = useState(() => {
    // Récupérer l'état du buzzer depuis le localStorage au chargement
    const savedBuzzedPlayer = localStorage.getItem('buzzedPlayer');
    return savedBuzzedPlayer ? JSON.parse(savedBuzzedPlayer) : null;
  });
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasJoinedGame, setHasJoinedGame] = useState(false);
  const [gameState, setGameState] = useState(0);
  const [buzzersEnabled, setBuzzersEnabled] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isInTeam, setIsInTeam] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [teamStatusChecked, setTeamStatusChecked] = useState(false);
  const [teamName, setTeamName] = useState(null); // 'team1' ou 'team2'
  
  
  
  // Hook de déconnexion automatique (30 minutes d'inactivité, avertissement à 25 minutes)
  const { showWarning, warningCountdown, handleStayConnected, handleLogoutNow } = useAutoLogout(30, 5);

  useEffect(() => {
    // Vérifier l'authentification au chargement
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsAuthenticated(true);
        
        // Rediriger les admins vers la page admin
        if (parsedUser.role === 'admin') {
          console.log("👑 Redirection vers la page admin");
          navigate('/admin');
          return;
        }
        
        // L'utilisateur est automatiquement dans la partie
      } catch (error) {
        console.error('Erreur lors du parsing des données utilisateur:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('gameState');
        navigate('/');
      }
    } else {
      // Rediriger vers la page d'accueil si pas connecté
      navigate('/');
    }

    // Vérifier l'état initial de la connexion
    setIsConnected(socket.connected);
    
    // Gestion de la connexion
    socket.on("connect", () => {
      setIsConnected(true);
      console.log("✅ Connecté au serveur");
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("❌ Déconnecté du serveur");
    });


    // Gestion du buzzer
    socket.on("playerBuzzed", (player) => {
      setBuzzedPlayer(player);
      localStorage.setItem('buzzedPlayer', JSON.stringify(player));
      console.log("🔔 État du buzzer reçu:", player);
    });

    // Reset du buzzer
    socket.on("buzzerReset", () => {
      setBuzzedPlayer(null);
      localStorage.removeItem('buzzedPlayer');
      console.log("🔄 Buzzer reset reçu");
    });

    // Écouter les changements d'état du jeu
    socket.on("gameStateChanged", (data) => {
      setGameState(data.gameState);
      console.log("🎮 État du jeu changé:", data.gameState);
    });

    // Écouter les changements d'état des buzzers
    socket.on("buzzersStateChanged", (data) => {
      console.log("🔔 Événement buzzersStateChanged reçu:", data);
      setBuzzersEnabled(data.enabled);
      console.log("🔔 État des buzzers changé:", data.enabled);
    });

    // Écouter le chrono depuis l'admin
    socket.on("countdownUpdate", (data) => {
      console.log("⏱️ Chrono reçu:", data.countdown);
      console.log("⏱️ Mise à jour du countdown state:", data.countdown);
      setCountdown(data.countdown);
    });

    // Écouter le statut d'équipe
    socket.on("teamStatus", (data) => {
      setIsInTeam(data.isInTeam);
      setTeamName(data.teamName || null);
      setTeamStatusChecked(true);
    });

    // Écouter les erreurs de buzzer
    socket.on("buzzerError", (data) => {
      alert(data.message);
    });

    // Écouter la demande de mise à jour du statut d'équipe
    socket.on("updateTeamStatus", () => {
      socket.emit("checkTeamStatus");
    });

    // Écouter la réponse du statut d'équipe
    socket.on("teamStatusResponse", (data) => {
      setIsInTeam(data.isInTeam);
      setTeamName(data.teamName || null);
      setTeamStatusChecked(true);
    });


    // Nettoyage
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("playerBuzzed");
      socket.off("buzzerReset");
      socket.off("gameStateChanged");
      socket.off("buzzersStateChanged");
      socket.off("countdownUpdate");
      socket.off("teamStatus");
      socket.off("buzzerError");
      socket.off("updateTeamStatus");
      socket.off("teamStatusResponse");
    };
  }, [navigate]);

  // Charger l'état du jeu et des buzzers au démarrage
  useEffect(() => {
    const loadGameState = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await fetch(`${API_URL}/api/game/state`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setGameState(data.gameState);
          setBuzzersEnabled(data.buzzersEnabled || false);
          console.log("🎮 État du jeu chargé:", data.gameState, "Buzzers:", data.buzzersEnabled);
        }
      } catch (error) {
        console.error('Erreur lors du chargement de l\'état du jeu:', error);
      }
    };
    
    loadGameState();
  }, []);

  // Vérifier si le joueur est bloqué
  useEffect(() => {
    const checkLockStatus = async () => {
      if (!user || !user.username) return;
      
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await fetch(`${API_URL}/api/auth/is-locked/${encodeURIComponent(user.username)}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setIsLocked(data.isLocked || false);
          console.log(`🔒 Statut de blocage pour ${user.username}:`, data.isLocked ? 'bloqué' : 'débloqué');
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du statut de blocage:', error);
      }
    };
    
    if (isAuthenticated && user) {
      checkLockStatus();
      // Vérifier périodiquement le statut de blocage
      const interval = setInterval(checkLockStatus, 2000); // Vérifier toutes les 2 secondes
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, user]);

  // Gestion du compte à rebours
  useEffect(() => {
    let interval;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 0.01) {
            return 0;
          }
          return prev - 0.01;
        });
      }, 10); // Mise à jour toutes les 10ms pour les centièmes
    }
    return () => clearInterval(interval);
  }, [countdown]);

  // Écouter les changements dans localStorage pour les noms d'équipe (pour mettre à jour l'affichage)
  useEffect(() => {
    const handleStorageChange = () => {
      // Forcer un re-render pour mettre à jour le nom de l'équipe affiché
      // Le composant se mettra à jour automatiquement via getTeamDisplayName() qui lit depuis localStorage
      setTeamName(prev => prev);
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Vérifier périodiquement les changements (pour les mêmes onglets/fenêtres)
    // Force un re-render périodiquement pour mettre à jour si les noms d'équipe changent
    const interval = setInterval(() => {
      setTeamName(prev => prev);
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [teamName]);

  // Rejoindre automatiquement quand l'utilisateur est défini et connecté
  useEffect(() => {
    if (isAuthenticated && user && isConnected && !hasJoinedGame) {
      // Petit délai pour s'assurer que la connexion est stable
      setTimeout(() => {
        // Les joueurs normaux rejoignent le jeu
        socket.emit('joinGame', user.username, false);
        setHasJoinedGame(true);
        console.log("🎮 Rejoint automatiquement la partie");
      }, 200);
    }
  }, [isAuthenticated, user, isConnected, hasJoinedGame]);


  // Éviter les reconnexions multiples
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated && user && isConnected) {
        // Ne pas rejoindre automatiquement si on revient sur l'onglet
        console.log("👁️ Onglet visible - pas de reconnexion");
      }
    };

    const handleBeforeUnload = () => {
      // Fermer la connexion Socket.IO quand l'utilisateur quitte la page
      socket.disconnect();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isAuthenticated, user, isConnected]);

  // Fonction pour buzzer
  const buzz = useCallback(() => {
    if (!isConnected) {
      console.log("❌ Pas connecté au serveur");
      return;
    }
    
    if (!buzzersEnabled) {
      console.log("❌ Les buzzers ne sont pas activés");
      return;
    }
    
    console.log("🔔 Tentative de buzzer...");
    socket.emit("buzz");
  }, [isConnected, buzzersEnabled]);

  // Gestion du buzzer avec la barre d'espace
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Ignorer si la barre d'espace n'est pas pressée
      if (event.code !== 'Space' && event.key !== ' ') {
        return;
      }

      // Ignorer si l'utilisateur est en train de taper dans un champ de texte
      const target = event.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Vérifier les conditions pour buzzer (mêmes que pour le bouton)
      if (!isConnected || buzzedPlayer || !buzzersEnabled || isLocked) {
        return;
      }

      // Empêcher le comportement par défaut (défilement de la page)
      event.preventDefault();
      
      // Buzzer
      buzz();
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [isConnected, buzzedPlayer, buzzersEnabled, isLocked, buzz]);


  const handleLogout = () => {
    // Fermer explicitement la connexion Socket.IO
    socket.disconnect();
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('gameState');
    setUser(null);
    setIsAuthenticated(false);
    setBuzzedPlayer(null);
    
    // Forcer un refresh de la page pour s'assurer que la déconnexion est bien détectée
    window.location.href = '/';
  };

  const returnToHome = () => {
    // Ne pas fermer la connexion Socket.IO, juste naviguer
    setBuzzedPlayer(null);
    // Nettoyer l'état du jeu du localStorage
    localStorage.removeItem('gameState');
    navigate('/');
  };

  // Fonction pour obtenir le nom d'affichage de l'équipe
  const getTeamDisplayName = () => {
    if (!teamName) return null;
    
    // Récupérer les noms personnalisés depuis localStorage
    const team1Name = localStorage.getItem('team1Name') || 'Équipe 1';
    const team2Name = localStorage.getItem('team2Name') || 'Équipe 2';
    
    return teamName === 'team1' ? team1Name : team2Name;
  };

  return (
    <>
      <AutoLogoutWarning
        isVisible={showWarning}
        onConfirm={handleLogoutNow}
        onCancel={handleStayConnected}
        remainingTime={warningCountdown}
      />
      <Header 
        user={user}
        onLogout={handleLogout}
        onReturnHome={returnToHome}
        isConnected={isConnected}
        buzzerNotification={buzzedPlayer}
        countdown={countdown}
      />
      <div className="game-main-content">

      {isAuthenticated && user ? (
        <>
          {gameState === 0 ? (
            <div className="waiting-info">
              <h2>⏳ En attente du lancement de la partie ...</h2>
            </div>
          ) : (
            <>
              {!teamStatusChecked ? (
                <div className="waiting-info">
                  <h2>⏳ Chargement...</h2>
                </div>
              ) : !isInTeam ? (
                <div className="no-team-info">
                  <h2>❌ Pas d'équipe assignée</h2>
                  <p>Vous devez être assigné à une équipe pour pouvoir participer au jeu.</p>
                </div>
              ) : (
                <>
                {getTeamDisplayName() && (
                    <h3 className="team-name-display">{getTeamDisplayName()}</h3>
                  )}
                  <h2 className="buzzer-title">Votre Buzzer</h2>
                  <button 
                    onClick={buzz}
                    disabled={!isConnected || buzzedPlayer || !buzzersEnabled || isLocked}
                    className={`buzzer-button ${buzzedPlayer || !buzzersEnabled || isLocked ? 'disabled' : ''}`}
                  >
                    {isLocked ? 'BUZZER BLOQUÉ' : !buzzersEnabled ? 'BUZZER DÉSACTIVÉ' : 'BUZZER'}
                  </button>
                </>
              )}
            </>
          )}
        </>
      ) : (
        <div className="auth-required">
          <p>Vous devez être connecté pour accéder au jeu.</p>
          <button onClick={returnToHome} className="auth-button">
            🔐 Se connecter
          </button>
        </div>
      )}
      </div>
      <Footer />
    </>
  );
}

export default GamePage;
