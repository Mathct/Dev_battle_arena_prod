import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import io from "socket.io-client";
import useAutoLogout from "../hooks/useAutoLogout";
import AutoLogoutWarning from "../components/AutoLogoutWarning";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "./AdminPage.css";
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

function AdminPage() {
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [players, setPlayers] = useState([]);
  const [connectedPlayers, setConnectedPlayers] = useState(new Set());
  const [buzzedPlayer, setBuzzedPlayer] = useState(() => {
    // Récupérer l'état du buzzer depuis le localStorage au chargement
    const savedBuzzedPlayer = localStorage.getItem('buzzedPlayer');
    return savedBuzzedPlayer ? JSON.parse(savedBuzzedPlayer) : null;
  });
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasJoinedGame, setHasJoinedGame] = useState(false);
  const [gameState, setGameState] = useState(0);
  const [teams, setTeams] = useState({ team1: [], team2: [] });
  const [scores, setScores] = useState({ team1: 0, team2: 0 });
  const [buzzersEnabled, setBuzzersEnabled] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [buzzedUsers, setBuzzedUsers] = useState([]);
  
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
        
        // Vérifier que l'utilisateur est bien un admin
        if (parsedUser.role !== 'admin') {
          console.log("❌ Accès refusé - rôle non admin");
          navigate('/game');
          return;
        }
        
        // Charger les équipes et les scores
        fetchTeams(token);
        fetchScores(token);
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
      console.log("✅ Connecté au serveur (Admin)");
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("❌ Déconnecté du serveur (Admin)");
    });

    // Gestion des joueurs en ligne
    socket.on("playersUpdate", (playersList) => {
      console.log("📋 Liste des joueurs reçue (Admin):", playersList);
      setPlayers(playersList);
      
      // Initialiser la liste des joueurs connectés avec tous les joueurs actuellement en ligne
      const connectedPlayerNames = new Set(playersList.map(player => player.name));
      setConnectedPlayers(connectedPlayerNames);
      console.log("🟢 Joueurs connectés initialisés:", Array.from(connectedPlayerNames));
      
      // Vérifier si un joueur a buzzé dans la liste
      const buzzedPlayerInList = playersList.find(player => player.buzzed);
      if (buzzedPlayerInList) {
        console.log("🔔 Joueur buzzé détecté dans la liste des joueurs:", buzzedPlayerInList);
        setBuzzedPlayer(buzzedPlayerInList);
        localStorage.setItem('buzzedPlayer', JSON.stringify(buzzedPlayerInList));
      }
    });

    // Gestion des connexions/déconnexions des joueurs
    socket.on("playerConnected", (playerName) => {
      console.log("🟢 Joueur connecté:", playerName);
      setConnectedPlayers(prev => new Set([...prev, playerName]));
    });

    socket.on("playerDisconnected", (playerName) => {
      console.log("🔴 Joueur déconnecté:", playerName);
      setConnectedPlayers(prev => {
        const newSet = new Set(prev);
        newSet.delete(playerName);
        return newSet;
      });
    });

    // Gestion du buzzer
    socket.on("playerBuzzed", (player) => {
      setBuzzedPlayer(player);
      localStorage.setItem('buzzedPlayer', JSON.stringify(player));
      console.log("🔔 État du buzzer reçu (Admin):", player);
      
      // Jouer le son de notification
      try {
        const audio = new Audio('/notif.mp3');
        audio.play().catch(error => {
          console.warn("⚠️ Impossible de jouer le son de notification:", error);
        });
      } catch (error) {
        console.warn("⚠️ Erreur lors de la création de l'audio:", error);
      }
      
      // Mise à jour de l'état local pour la cohérence
      setCountdown(0);
      setBuzzersEnabled(false);
      console.log("⏱️ État local mis à jour après buzz");
      
      // Recharger la liste des utilisateurs qui ont buzzé
      const loadBuzzedUsers = async () => {
        try {
          const token = localStorage.getItem('token');
          if (!token) return;
          
          const response = await fetch(`${API_URL}/api/auth/buzzed-users`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            setBuzzedUsers(data.buzzedUsers);
            console.log("🔴 Liste des utilisateurs qui ont buzzé mise à jour:", data.buzzedUsers);
          }
        } catch (error) {
          console.error('Erreur lors du chargement des utilisateurs qui ont buzzé:', error);
        }
      };
      loadBuzzedUsers();
    });

    // Reset du buzzer
    socket.on("buzzerReset", () => {
      setBuzzedPlayer(null);
      localStorage.removeItem('buzzedPlayer');
      console.log("🔄 Buzzer reset reçu (Admin)");

      // Recharger la liste des utilisateurs qui ont buzzé pour mettre à jour les verrous
      // Ajouter un petit délai pour s'assurer que le DELETE dans la base de données est terminé
      const loadBuzzedUsers = async () => {
        try {
          const token = localStorage.getItem('token');
          if (!token) return;
          
           // Petit délai pour laisser le temps au DELETE de se terminer
          await new Promise(resolve => setTimeout(resolve, 100));

          const response = await fetch(`${API_URL}/api/auth/buzzed-users`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            setBuzzedUsers(data.buzzedUsers);
            console.log("🔄 Liste des utilisateurs qui ont buzzé rechargée après reset:", data.buzzedUsers);
          } else {
            // Si l'API échoue, fallback: vider la liste localement
            setBuzzedUsers([]);
          }
        } catch (error) {
          console.error('Erreur lors du rechargement des utilisateurs qui ont buzzé après reset:', error);
          setBuzzedUsers([]);
        }
      };
      loadBuzzedUsers();
    });

    // Écouter les changements d'état du jeu
    socket.on("gameStateChanged", (data) => {
      setGameState(data.gameState);
      console.log("🎮 État du jeu changé (Admin):", data.gameState);
    });

    // Écouter les changements d'état des buzzers
    socket.on("buzzersStateChanged", (data) => {
      setBuzzersEnabled(data.enabled);
      console.log("🔔 État des buzzers reçu (Admin):", data.enabled);
    });

    // Écouter le chrono depuis le serveur
    socket.on("countdownUpdate", (data) => {
      console.log("⏱️ Chrono reçu depuis le serveur (Admin):", data.countdown);
      setCountdown(data.countdown);
    });

    // Nettoyage
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("playersUpdate");
      socket.off("playerBuzzed");
      socket.off("buzzerReset");
      socket.off("gameStateChanged");
      socket.off("buzzersStateChanged");
      socket.off("countdownUpdate");
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
    
    const loadBuzzedUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await fetch(`${API_URL}/api/auth/buzzed-users`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setBuzzedUsers(data.buzzedUsers);
          console.log("🔴 Utilisateurs qui ont buzzé:", data.buzzedUsers);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des utilisateurs qui ont buzzé:', error);
      }
    };
    
    loadGameState();
    loadBuzzedUsers();
  }, []);

  // Rejoindre automatiquement en mode admin quand l'utilisateur est défini et connecté
  useEffect(() => {
    if (isAuthenticated && user && isConnected && !hasJoinedGame) {
      // Petit délai pour s'assurer que la connexion est stable
      setTimeout(() => {
        // Les admins se connectent au serveur mais ne rejoignent pas le jeu
        socket.emit('joinGame', user.username, true);
        setHasJoinedGame(true);
        console.log("👑 Admin connecté au serveur (mode surveillance)");
      }, 200);
    }
  }, [isAuthenticated, user, isConnected, hasJoinedGame]);


  // Éviter les reconnexions multiples
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated && user && isConnected) {
        // Ne pas rejoindre automatiquement si on revient sur l'onglet
        console.log("👁️ Onglet visible - pas de reconnexion (Admin)");
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

  const resetBuzzer = () => {
    if (isConnected) {
      console.log("🔄 Reset du buzzer par l'admin");
      socket.emit("resetBuzzer");
      
      // Désactiver les buzzers après reset (le serveur gère le chrono)
      setBuzzersEnabled(false);
      setCountdown(0);
      if (socket && socket.connected) {
        socket.emit('buzzersStateChanged', { enabled: false });
        console.log("🔔 Buzzers désactivés après reset (chrono géré par le serveur)");
      }
    } else {
      console.log("❌ Pas connecté au serveur");
    }
  };

  const startGame = async () => {
    // Debug: Afficher les équipes
    console.log('🔍 Équipes actuelles:', teams);
    console.log('🔍 Équipe 1:', teams.team1.length, 'joueurs');
    console.log('🔍 Équipe 2:', teams.team2.length, 'joueurs');

    try {
      const response = await fetch(`${API_URL}/api/game/state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ gameState: 1 })
      });

      if (response.ok) {
        setGameState(1);
        setBuzzersEnabled(false); // Désactiver les buzzers au démarrage
        console.log("🎮 Partie démarrée par l'admin");
      } else {
        alert('Erreur lors du démarrage de la partie');
      }
    } catch (error) {
      console.error('Erreur lors du démarrage de la partie:', error);
      alert('Erreur lors du démarrage de la partie');
    }
  };

  const stopGame = async () => {
    try {
      const response = await fetch(`${API_URL}/api/game/state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ gameState: 0 })
      });

      if (response.ok) {
        setGameState(0);
        setBuzzersEnabled(false); // Désactiver les buzzers à l'arrêt
        setBuzzedPlayer(null); // Annuler le buzz en cours
        setCountdown(0); // Arrêter le chrono
        
        // Notifier tous les joueurs que les buzzers sont désactivés (le serveur gère le chrono)
        if (socket && socket.connected) {
          socket.emit('buzzersStateChanged', { enabled: false });
          socket.emit('resetBuzzer'); // Reset du buzzer pour tous les joueurs
          console.log("🔔 Buzzers désactivés et buzzer reset envoyés à tous les joueurs (chrono géré par le serveur)");
        }
        
        console.log("🛑 Partie arrêtée par l'admin - Buzzer annulé");
      } else {
        alert('Erreur lors de l\'arrêt de la partie');
      }
    } catch (error) {
      console.error('Erreur lors de l\'arrêt de la partie:', error);
      alert('Erreur lors de l\'arrêt de la partie');
    }
  };

  const handleLogout = () => {
    // Fermer explicitement la connexion Socket.IO
    socket.disconnect();
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('gameState');
    localStorage.removeItem('buzzedPlayer');
    setUser(null);
    setIsAuthenticated(false);
    setBuzzedPlayer(null);
    setPlayers([]);
    
    // Forcer un refresh de la page pour s'assurer que la déconnexion est bien détectée
    window.location.href = '/';
  };

  const returnToHome = () => {
    // Ne pas fermer la connexion Socket.IO, juste naviguer
    setBuzzedPlayer(null);
    setPlayers([]);
    // Nettoyer l'état du jeu du localStorage
    localStorage.removeItem('gameState');
    navigate('/');
  };

  const goToTeams = () => {
    navigate('/teams');
  };

  // Fonction pour récupérer les équipes assignées
  const fetchTeams = async (token) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/teams`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setTeams(data.teams);
        console.log('✅ Équipes chargées dans AdminPage:', data.teams);
      } else {
        console.error('❌ Erreur lors du chargement des équipes:', data.message);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la requête des équipes:', error);
    }
  };

  // Fonction pour récupérer les scores des équipes
  const fetchScores = async (token) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/scores`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setScores(data.scores);
        console.log('✅ Scores chargés dans AdminPage:', data.scores);
      } else {
        console.error('❌ Erreur lors du chargement des scores:', data.message);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la requête des scores:', error);
    }
  };

  // Fonction pour mettre à jour le score d'une équipe
  const updateScore = async (teamName, newScore) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/auth/scores/${teamName}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ score: newScore })
      });

      const data = await response.json();

      if (data.success) {
        setScores(prev => ({
          ...prev,
          [teamName]: newScore
        }));
        console.log('✅ Score mis à jour:', data.message);
      } else {
        console.error('❌ Erreur lors de la mise à jour du score:', data.message);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la requête de mise à jour:', error);
    }
  };

  // Fonction pour réinitialiser tous les scores
  const resetScores = async () => {
    const confirmed = window.confirm('Êtes-vous sûr de vouloir réinitialiser tous les scores à 0 ?');
    if (!confirmed) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      // Mettre à jour les scores des deux équipes à 0
      await updateScore('team1', 0);
      await updateScore('team2', 0);
      
      console.log('✅ Tous les scores ont été réinitialisés à 0');
    } catch (error) {
      console.error('❌ Erreur lors de la réinitialisation des scores:', error);
      alert('Erreur lors de la réinitialisation des scores');
    }
  };

  const clearBuzzes = async () => {
    console.log('🔓 Tentative de déblocage des buzzers...');
    const confirmed = window.confirm('Êtes-vous sûr de vouloir débloquer tous les buzzers ?');
    if (!confirmed) {
      console.log('❌ Déblocage annulé par l\'utilisateur');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.log('❌ Token manquant');
      return;
    }

    try {
      console.log('📡 Envoi de la requête DELETE vers /api/auth/clear-buzzes');
      const response = await fetch(`${API_URL}/api/auth/clear-buzzes`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📡 Réponse reçue:', response.status, response.statusText);
      const data = await response.json();
      console.log('📡 Données de réponse:', data);

      if (data.success) {
        setBuzzedUsers([]);
        console.log('✅ Tous les buzzers ont été débloqués');
      } else {
        console.error('❌ Erreur lors du déblocage des buzzers:', data.message);
        alert('Erreur lors du déblocage des buzzers');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la requête de déblocage des buzzers:', error);
      alert('Erreur lors du déblocage des buzzers');
    }
  };

  const togglePlayerLock = async (username) => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('❌ Token manquant');
      return;
    }

    // Vérifier si le joueur est actuellement bloqué
    const isLocked = buzzedUsers.some(user => user.username === username);
    const endpoint = isLocked ? 'unlock-player' : 'lock-player';
    const method = isLocked ? 'DELETE' : 'POST';
    const action = isLocked ? 'déblocage' : 'blocage';

    try {
      console.log(`🔓 Tentative de ${action} du joueur ${username}...`);
      const response = await fetch(`${API_URL}/api/auth/${endpoint}/${encodeURIComponent(username)}`, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        // Recharger la liste des joueurs qui ont buzzé pour mettre à jour l'état
        const loadBuzzedUsers = async () => {
          try {
            const token = localStorage.getItem('token');
            if (!token) return;
            
            const response = await fetch(`${API_URL}/api/auth/buzzed-users`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            if (response.ok) {
              const data = await response.json();
              setBuzzedUsers(data.buzzedUsers);
            }
          } catch (error) {
            console.error('Erreur lors du rechargement des utilisateurs qui ont buzzé:', error);
          }
        };
        await loadBuzzedUsers();
        console.log(`✅ Joueur ${username} ${isLocked ? 'débloqué' : 'bloqué'} avec succès`);
      } else {
        console.error(`❌ Erreur lors du ${action} du joueur:`, data.message);
        alert(`Erreur lors du ${action} du joueur`);
      }
    } catch (error) {
      console.error(`❌ Erreur lors de la requête de ${action} du joueur:`, error);
      alert(`Erreur lors du ${action} du joueur`);
    }
  };

  const unlockTeamBuzzers = async (teamName) => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('❌ Token manquant');
      return;
    }

    const team = teamName === 'team1' ? teams.team1 : teams.team2;
    if (team.length === 0) {
      console.log(`⚠️ Aucun joueur dans ${teamName}`);
      return;
    }

    const confirmed = window.confirm(`Êtes-vous sûr de vouloir débloquer tous les buzzers de l'${teamName === 'team1' ? 'Équipe 1' : 'Équipe 2'} ?`);
    if (!confirmed) {
      return;
    }

    try {
      // Débloquer tous les joueurs de l'équipe
      const unlockPromises = team.map(player => 
        fetch(`${API_URL}/api/auth/unlock-player/${encodeURIComponent(player.username)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      );

      await Promise.all(unlockPromises);

      // Recharger la liste des joueurs qui ont buzzé
      const loadBuzzedUsers = async () => {
        try {
          const token = localStorage.getItem('token');
          if (!token) return;
          
          const response = await fetch(`${API_URL}/api/auth/buzzed-users`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            setBuzzedUsers(data.buzzedUsers);
          }
        } catch (error) {
          console.error('Erreur lors du rechargement des utilisateurs qui ont buzzé:', error);
        }
      };
      await loadBuzzedUsers();
      console.log(`✅ Tous les buzzers de l'${teamName === 'team1' ? 'Équipe 1' : 'Équipe 2'} ont été débloqués`);
    } catch (error) {
      console.error(`❌ Erreur lors du déblocage des buzzers de l'équipe:`, error);
      alert('Erreur lors du déblocage des buzzers de l\'équipe');
    }
  };


  const validateResponse = async () => {
    if (!buzzedPlayer) return;

    // Trouver l'équipe du joueur qui a buzzé
    let playerTeam = null;
    if (teams.team1.find(player => player.username === buzzedPlayer.name)) {
      playerTeam = 'team1';
    } else if (teams.team2.find(player => player.username === buzzedPlayer.name)) {
      playerTeam = 'team2';
    }

    if (!playerTeam) {
      console.error('❌ Impossible de trouver l\'équipe du joueur');
      return;
    }

    // Incrémenter le score de l'équipe
    const newScore = scores[playerTeam] + 1;
    await updateScore(playerTeam, newScore);

    // Fin de manche sans déblocage
    if (isConnected && socket && socket.connected) {
      socket.emit('endRoundNoUnlock');
    }
    setBuzzedPlayer(null);
    
    console.log(`✅ Réponse validée ! ${buzzedPlayer.name} (${playerTeam}) gagne 1 point`);
  };

  const rejectResponse = async () => {
    if (!buzzedPlayer) return;
    
    // Déterminer l'équipe du joueur qui a buzzé
    const playerTeam = teams.team1.find(player => player.username === buzzedPlayer.name) ? 'team1' : 
                      teams.team2.find(player => player.username === buzzedPlayer.name) ? 'team2' : null;
    
    if (playerTeam) {
      // Donner un point à l'équipe adverse
      const opponentTeam = playerTeam === 'team1' ? 'team2' : 'team1';
      const newScore = scores[opponentTeam] + 1;
      
      try {
        await updateScore(opponentTeam, newScore);
        console.log(`❌ Réponse refusée ! ${opponentTeam} gagne 1 point (score: ${newScore})`);
      } catch (error) {
        console.error('❌ Erreur lors de l\'attribution du point à l\'équipe adverse:', error);
      }
    }
    
    // Appeler l'API pour marquer la réponse comme rejetée
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await fetch(`${API_URL}/api/auth/reject-response`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            username: buzzedPlayer.name,
            gameSessionId: 'default'
          })
        });
        
        if (response.ok) {
          console.log('✅ Réponse marquée comme rejetée dans la base de données');
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors du rejet de la réponse:', error);
    }
    
    // Fin de manche sans déblocage
    if (isConnected && socket && socket.connected) {
      socket.emit('endRoundNoUnlock');
    }
    setBuzzedPlayer(null);
    
    console.log(`❌ Réponse refusée pour ${buzzedPlayer.name}`);
  };

  const toggleBuzzers = useCallback(() => {
    const newState = !buzzersEnabled;

    // Bloquer uniquement l'activation si quelqu'un a déjà buzzé
    if (newState && buzzedPlayer) {
      console.log("⚠️ Impossible d'activer les buzzers car quelqu'un a déjà buzzé");
      return;
    }
    
    setBuzzersEnabled(newState);
    
    // Mise à jour de l'état local
    if (newState) {
      setCountdown(5.00); // Valeur initiale pour l'affichage
    } else {
      setCountdown(0);
    }
    
    // Envoyer l'état des buzzers au serveur
    if (socket && socket.connected) {
      socket.emit('buzzersStateChanged', { enabled: newState });
      console.log(`🔔 État des buzzers envoyé au serveur: ${newState ? 'activés' : 'désactivés'}`);
    } else {
      console.log('❌ Socket non connecté');
    }
    
    console.log(`🔔 Buzzers ${newState ? 'activés' : 'désactivés'}`);
  }, [buzzersEnabled, buzzedPlayer]);

  // Contrôle admin: barre d'espace pour GO/STOP du chrono
  useEffect(() => {
    const handleAdminSpaceToggle = (event) => {
      // Ecarter si ce n'est pas la barre d'espace ou si la touche est répétée
      if ((event.code !== 'Space' && event.key !== ' ') || event.repeat) {
        return;
      }

      // Ignorer si l'utilisateur est en train de saisir du texte
      const target = event.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      // Conditions minimales: connecté, partie en cours
      if (!isConnected || gameState !== 1) {
        return;
      }

      event.preventDefault();
      toggleBuzzers();
    };

    window.addEventListener('keydown', handleAdminSpaceToggle);
    return () => {
      window.removeEventListener('keydown', handleAdminSpaceToggle);
    };
  }, [isConnected, gameState, buzzersEnabled, buzzedPlayer, toggleBuzzers]);



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
        buzzerControl={{
          enabled: buzzersEnabled,
          onToggle: toggleBuzzers,
          gameState: gameState,
          buzzedPlayer: buzzedPlayer,
          countdown: countdown
        }}
      />
      <div className="admin-main-content">
        {isAuthenticated && user ? (
          <div className="admin-section">
            <div className="game-status-container">
              <div className="game-controls">
                <h2>Contrôle de la Partie</h2>
                <div className="game-state-info">
                  <p>État actuel: <span className={`state-indicator ${gameState === 1 ? 'active' : 'waiting'}`}>
                    {gameState === 1 ? '🎮 Partie en cours' : '⏳ En attente'}
                  </span></p>
                </div>
                <div className="game-buttons">
                  {gameState === 0 ? (
                    <button 
                      onClick={startGame} 
                      className={`start-game-btn ${teams.team1.length === 0 || teams.team2.length === 0 ? 'disabled' : ''}`}
                      disabled={teams.team1.length === 0 || teams.team2.length === 0}
                    >
                      {teams.team1.length === 0 || teams.team2.length === 0 ? '❌ Équipes incomplètes' : '🚀 Démarrer la Partie - Afficher les buzzers'}
                    </button>
                  ) : (
                    <div className="game-controls-active">
                      <button onClick={stopGame} className="stop-game-btn">
                        🛑 Arrêter la Partie - Masquer les buzzers
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {buzzedPlayer ? (
                <div className="buzzed-info">
                  <h2>
                  <span className="team-buzzed-bell">🔔</span> {buzzedPlayer.name} a buzzé {(() => {
                    const inTeam1 = teams.team1.find(player => player.username === buzzedPlayer.name);
                    const inTeam2 = teams.team2.find(player => player.username === buzzedPlayer.name);
                    if (inTeam1) return `(Équipe 1)`;
                    if (inTeam2) return `(Équipe 2)`;
                    return '';
                  })()}
                  </h2>
                  <div className="buzzed-player-card">
                    <div className="buzzer-actions">
                      <button onClick={validateResponse} className="validate-response-btn">
                        ✅ Valider réponse
                      </button>
                      <button onClick={rejectResponse} className="reject-response-btn">
                        ❌ Refuser réponse
                      </button>
                    </div>
                    <button onClick={resetBuzzer} className="reset-button admin-reset">
                      🔄 Annuler le Buzz
                    </button>
                  </div>
                </div>
              ) : (
                <div className="waiting-info">
                  <h2>⏳ En attente</h2>
                  <p>Aucun joueur n'a encore buzzé...</p>
                </div>
              )}
            </div>

            {/* Section équipes - toujours visible */}
            <div className="teams-display">
              <div className="teams-header">
                <h2>Équipes</h2>
                <div className="teams-actions">
                  <button 
                    onClick={goToTeams} 
                    className={`teams-btn ${gameState === 1 ? 'disabled' : ''}`}
                    disabled={gameState === 1}
                  >
                    Gestion des Équipes
                  </button>
                  <button 
                    onClick={resetScores} 
                    className={`reset-scores-btn ${gameState === 1 ? 'disabled' : ''}`}
                    disabled={gameState === 1}
                  >
                    Réinitialiser les Scores
                  </button>
                  <button 
                    onClick={clearBuzzes} 
                    className="clear-buzzes-btn"
                  >
                    Débloquer tous les Buzzers
                  </button>
                </div>
              </div>
              
              {/* Affichage des équipes si elles existent */}
              {(teams.team1.length > 0 || teams.team2.length > 0) && (
                <div className="teams-container">
                  <div className="team-display team-1">
                    <div className="team-header">
                      <h3>
                        Équipe 1
                        {buzzedPlayer && teams.team1.find(player => player.username === buzzedPlayer.name) && (
                          <span className="team-buzzed-bell">🔔</span>
                        )}
                      </h3>
                      <div className="score-display">
                        <span className="score-value">{scores.team1}</span>
                        <div className="score-controls">
                          <button 
                            className="score-btn minus"
                            onClick={() => updateScore('team1', Math.max(0, scores.team1 - 1))}
                          >
                            -
                          </button>
                          <button 
                            className="score-btn plus"
                            onClick={() => updateScore('team1', scores.team1 + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="team-actions-header">
                      <button 
                        className="unlock-team-btn"
                        onClick={() => unlockTeamBuzzers('team1')}
                        title="Débloquer tous les buzzers de l'Équipe 1"
                      >
                        🔓 Débloquer les buzzers de l'équipe 1
                      </button>
                    </div>
                    <div className="team-players">
                      {teams.team1.length === 0 ? (
                        <p className="empty-team">Aucun joueur</p>
                      ) : (
                        teams.team1.map((player) => {
                          const hasBuzzed = buzzedUsers.some(buzzedUser => buzzedUser.username === player.username);
                          return (
                            <div key={player.id} className={`team-player ${hasBuzzed ? 'buzzed' : ''}`}>
                              <span className={`player-name ${connectedPlayers.has(player.username) ? 'online' : 'offline'}`}>
                                {player.username}
                              </span>
                              <div className="player-icons">
                                {connectedPlayers.has(player.username) && (
                                  <span className="online-indicator">🟢</span>
                                )}
                                {buzzedPlayer && buzzedPlayer.name === player.username && (
                                  <span className="buzzed-indicator">🔔</span>
                                )}
                                <button 
                                  className={`lock-btn ${hasBuzzed ? 'locked' : 'unlocked'}`}
                                  onClick={() => togglePlayerLock(player.username)}
                                  title={hasBuzzed ? 'Débloquer ce joueur' : 'Bloquer ce joueur'}
                                >
                                  {hasBuzzed ? '🔓' : '🔒'}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  
                  <div className="team-display team-2">
                    <div className="team-header">
                    <h3>
                        Équipe 2
                        {buzzedPlayer && teams.team2.find(player => player.username === buzzedPlayer.name) && (
                          <span className="team-buzzed-bell">🔔</span>
                        )}
                      </h3>
                      <div className="score-display">
                        <span className="score-value">{scores.team2}</span>
                        <div className="score-controls">
                          <button 
                            className="score-btn minus"
                            onClick={() => updateScore('team2', Math.max(0, scores.team2 - 1))}
                          >
                            -
                          </button>
                          <button 
                            className="score-btn plus"
                            onClick={() => updateScore('team2', scores.team2 + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="team-actions-header">
                      <button 
                        className="unlock-team-btn"
                        onClick={() => unlockTeamBuzzers('team2')}
                        title="Débloquer tous les buzzers de l'Équipe 2"
                      >
                        🔓 Débloquer les buzzers de l'équipe 2
                      </button>
                    </div>
                    <div className="team-players">
                      {teams.team2.length === 0 ? (
                        <p className="empty-team">Aucun joueur</p>
                      ) : (
                        teams.team2.map((player) => {
                          const hasBuzzed = buzzedUsers.some(buzzedUser => buzzedUser.username === player.username);
                          return (
                            <div key={player.id} className={`team-player ${hasBuzzed ? 'buzzed' : ''}`}>
                              <span className={`player-name ${connectedPlayers.has(player.username) ? 'online' : 'offline'}`}>
                                {player.username}
                              </span>
                              <div className="player-icons">
                                {connectedPlayers.has(player.username) && (
                                  <span className="online-indicator">🟢</span>
                                )}
                                {buzzedPlayer && buzzedPlayer.name === player.username && (
                                  <span className="buzzed-indicator">🔔</span>
                                )}
                                <button 
                                  className={`lock-btn ${hasBuzzed ? 'locked' : 'unlocked'}`}
                                  onClick={() => togglePlayerLock(player.username)}
                                  title={hasBuzzed ? 'Débloquer ce joueur' : 'Bloquer ce joueur'}
                                >
                                  {hasBuzzed ? '🔓' : '🔒'}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Message si pas d'équipes */}
              {teams.team1.length === 0 && teams.team2.length === 0 && (
                <div className="no-teams-message">
                  <p>Aucune équipe assignée. Cliquez sur "Gestion des Équipes" pour créer ou modifier les équipes.</p>
                </div>
              )}
            </div>

            <div className="players-section">
              <h2>Joueurs en ligne ({players.length})</h2>
              <div className="players-list">
                {players
                  .filter(player => 
                    player && 
                    player.name && 
                    typeof player.name === 'string' && 
                    player.name.trim() !== '' &&
                    player.name.trim().length > 0
                  )
                  .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
                  .map((player) => (
                  <div 
                    key={player.id || player.name} 
                    className={`player-item ${player.buzzed ? 'buzzed' : ''}`}
                  >
                    <span className="player-name">{player.name}</span>
                    {player.buzzed && <span className="buzzed-indicator">🔔</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="auth-required">
            <p>Vous devez être connecté en tant qu'administrateur pour accéder à cette page.</p>
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

export default AdminPage;
