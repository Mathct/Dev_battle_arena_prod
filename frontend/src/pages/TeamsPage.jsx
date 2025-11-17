import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router";
import useAutoLogout from "../hooks/useAutoLogout";
import AutoLogoutWarning from "../components/AutoLogoutWarning";
import Header from "../components/Header";
import Footer from "../components/Footer";
import "./TeamsPage.css";
import { API_URL } from "../config/api";

function TeamsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [team1, setTeam1] = useState([]);
  const [team2, setTeam2] = useState([]);
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
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
        
        // Charger la liste des utilisateurs et des équipes
        fetchUsers(token);
        fetchTeams(token);
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
  }, [navigate]);

  // Fonction pour récupérer tous les utilisateurs
  const fetchUsers = async (token) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setRegisteredUsers(data.users);
        console.log('✅ Utilisateurs chargés:', data.users);
      } else {
        console.error('❌ Erreur lors du chargement des utilisateurs:', data.message);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la requête:', error);
    }
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
        setTeam1(data.teams.team1);
        setTeam2(data.teams.team2);
        console.log('✅ Équipes chargées:', data.teams);
      } else {
        console.error('❌ Erreur lors du chargement des équipes:', data.message);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la requête des équipes:', error);
    }
  };

  // Fonction pour assigner un utilisateur à une équipe
  const assignUserToTeam = (userId, teamNumber) => {
    const user = registeredUsers.find(u => u.id === userId);
    if (!user) return;

    if (teamNumber === 1) {
      // Retirer de l'équipe 2 si présent
      setTeam2(prev => prev.filter(player => player.id !== userId));
      // Ajouter à l'équipe 1 si pas déjà présent
      setTeam1(prev => {
        if (prev.find(player => player.id === userId)) return prev;
        return [...prev, user];
      });
    } else {
      // Retirer de l'équipe 1 si présent
      setTeam1(prev => prev.filter(player => player.id !== userId));
      // Ajouter à l'équipe 2 si pas déjà présent
      setTeam2(prev => {
        if (prev.find(player => player.id === userId)) return prev;
        return [...prev, user];
      });
    }
  };

  // Fonction pour retirer un utilisateur d'une équipe
  const removeUserFromTeam = (userId, teamNumber) => {
    if (teamNumber === 1) {
      setTeam1(prev => prev.filter(player => player.id !== userId));
    } else {
      setTeam2(prev => prev.filter(player => player.id !== userId));
    }
  };

  // Fonction pour valider les équipes
  const validateTeams = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/assign-teams`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          team1: team1.map(player => player.id),
          team2: team2.map(player => player.id)
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Équipes validées avec succès:', data.message);
        // Rediriger vers la page admin après validation
        navigate('/admin');
      } else {
        console.error('❌ Erreur lors de la validation:', data.message);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la requête:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour tout réinitialiser (équipes, buzzers, scores)
  const resetAll = async () => {
    const confirmed = window.confirm(
      '⚠️ ATTENTION : Cette action va :\n' +
      '• Vider toutes les équipes\n' +
      '• Débloquer tous les buzzers\n' +
      '• Réinitialiser les scores à 0\n\n' +
      'Êtes-vous sûr de vouloir continuer ?'
    );
    
    if (!confirmed) return;

    const token = localStorage.getItem('token');
    if (!token) {
      alert('❌ Token manquant');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Réinitialisation complète effectuée:', data.message);
        // Vider les équipes locales
        setTeam1([]);
        setTeam2([]);
      } else {
        console.error('❌ Erreur lors de la réinitialisation:', data.message);
        alert('❌ Erreur lors de la réinitialisation: ' + data.message);
      }
    } catch (error) {
      console.error('❌ Erreur lors de la requête:', error);
      alert('❌ Erreur lors de la réinitialisation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('gameState');
    setUser(null);
    setIsAuthenticated(false);
    
    // Forcer un refresh de la page pour s'assurer que la déconnexion est bien détectée
    window.location.href = '/';
  };

  const returnToHome = () => {
    navigate('/');
  };

  const goToAdmin = () => {
    navigate('/admin');
  };

  // Liste dérivée: utilisateurs non assignés (n'apparaissent pas dans team1 ni team2)
  const unassignedUsers = useMemo(() => {
    const assignedIds = new Set([
      ...team1.map(p => p.id),
      ...team2.map(p => p.id),
    ]);
    return registeredUsers.filter(u => !assignedIds.has(u.id));
  }, [registeredUsers, team1, team2]);

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
        isConnected={true}
      />
      <div className="teams-main-content">
        {isAuthenticated && user ? (
          <div className="teams-section">
            <div className="teams-header">
              <h1>Gestion des Équipes</h1>
              <button onClick={goToAdmin} className="teams-btn admin-btn return-btn">
                Retour
              </button>
            </div>

            <div className="teams-controls">
            <div className="teams-controls-spacer"></div>
              <button 
                onClick={validateTeams} 
                className="teams-btn validate-btn"
                disabled={isLoading}
              >
                {isLoading ? 'Sauvegarde...' : '✅ Sauvegarder les équipes'}
              </button>
              <div className="teams-controls-right">
                <button 
                  onClick={resetAll} 
                  className="teams-btn reset-all-btn"
                  disabled={isLoading}
                >
                  🔄 Tout réinitialiser
                </button>
              </div>
            </div>

            {/* Structure des 3 cartes */}
            <div className="teams-layout">
              {/* Carte Equipe 1 - Gauche */}
              <div className="team-card team-1">
                <div className="team-header">
                  <h2>Équipe 1</h2>
                  <span className="team-count">{team1.length} joueurs</span>
                </div>
                <div className="team-players">
                  {team1.length === 0 ? (
                    <p className="empty-team">Aucun joueur assigné</p>
                  ) : (
                    team1.map((player) => (
                      <div key={player.id} className="player-item">
                        <span className="player-name">{player.username}</span>
                        <button 
                          className="remove-player-btn"
                          onClick={() => removeUserFromTeam(player.id, 1)}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Carte Liste des utilisateurs - Centre */}
              <div className="team-card users-list">
                <div className="team-header">
                  <h2>Joueurs non assignés</h2>
                </div>
                <div className="team-players">
                  {unassignedUsers.length === 0 ? (
                    <p className="empty-team">Aucun joueur non assigné</p>
                  ) : (
                    unassignedUsers.map((user) => (
                      <div key={user.id} className="player-item">
                        <div className="player-info">
                          <span className="player-name">{user.username}</span>
                        </div>
                        <div className="player-actions">
                          <button 
                            className="assign-btn team1-btn"
                            onClick={() => assignUserToTeam(user.id, 1)}
                          >
                            Équipe 1
                          </button>
                          <button 
                            className="assign-btn team2-btn"
                            onClick={() => assignUserToTeam(user.id, 2)}
                          >
                            Équipe 2
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Carte Equipe 2 - Droite */}
              <div className="team-card team-2">
                <div className="team-header">
                  <h2>Équipe 2</h2>
                  <span className="team-count">{team2.length} joueurs</span>
                </div>
                <div className="team-players">
                  {team2.length === 0 ? (
                    <p className="empty-team">Aucun joueur assigné</p>
                  ) : (
                    team2.map((player) => (
                      <div key={player.id} className="player-item">
                        <span className="player-name">{player.username}</span>
                        <button 
                          className="remove-player-btn"
                          onClick={() => removeUserFromTeam(player.id, 2)}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
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

export default TeamsPage;
