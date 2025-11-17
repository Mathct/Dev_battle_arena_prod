import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import "./HomePage.css";
import CrtEffect from "../components/CrtEffect";
import { API_URL } from "../config/api";

function HomePage() {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Vérifier si l'utilisateur est déjà connecté
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        // Rediriger selon le rôle de l'utilisateur
        if (parsedUser.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/game');
        }
      } catch (error) {
        console.error('Erreur lors du parsing des données utilisateur:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, [navigate]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isLogin) {
        // Connexion
        const response = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: formData.username,
            password: formData.password
          })
        });

        const data = await response.json();

        if (data.success) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          setMessage('Connexion réussie !');
          setTimeout(() => {
            // Rediriger selon le rôle
            if (data.user.role === 'admin') {
              navigate('/admin');
            } else {
              navigate('/game');
            }
          }, 1000);
        } else {
          setMessage(data.message);
        }
      } else {
        // Inscription
        if (formData.password !== formData.confirmPassword) {
          setMessage('Les mots de passe ne correspondent pas');
          setLoading(false);
          return;
        }

        const response = await fetch(`${API_URL}/api/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: formData.username,
            email: formData.email,
            password: formData.password
          })
        });

        const data = await response.json();

        if (data.success) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          setMessage('Inscription réussie !');
          setTimeout(() => {
            // Rediriger selon le rôle
            if (data.user.role === 'admin') {
              navigate('/admin');
            } else {
              navigate('/game');
            }
          }, 1000);
        } else {
          setMessage(data.message);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la requête:', error);
      setMessage('Erreur de connexion au serveur');
    }

    setLoading(false);
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setFormData({
      username: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
    setMessage('');
  };

  return (
    <div className="homepage-container">
      {/* Effet de vieille télé cathodique */}
      <CrtEffect />
      
      {!showAuth ? (
        <>
          {/* Bouton d'entrée */}
          <div className="enter-section">
            <button 
              className={`enter-button ${isHovered ? 'hovered' : ''}`}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={() => setShowAuth(true)}
            >
              <span className="button-text">ENTRER DANS L'ARÈNE</span>
            </button>
          </div>
        </>
      ) : (
        <div className="auth-container">
          <div className="auth-form">
            <h2>{isLogin ? 'Connexion' : 'Inscription'}</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <input
                  type="text"
                  name="username"
                  placeholder={isLogin ? "Nom d'utilisateur ou Email" : "Nom d'utilisateur"}
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {!isLogin && (
                <div className="form-group">
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <input
                  type="password"
                  name="password"
                  placeholder="Mot de passe"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                />
              </div>

              {!isLogin && (
                <div className="form-group">
                  <input
                    type="password"
                    name="confirmPassword"
                    placeholder="Confirmer le mot de passe"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              )}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? 'Chargement...' : (isLogin ? 'Se connecter' : 'S\'inscrire')}
              </button>
            </form>

            {message && (
              <div className={`message ${message.includes('réussie') ? 'success' : 'error'}`}>
                {message}
              </div>
            )}

            <div className="auth-switch">
              <p>
                {isLogin ? 'Pas encore de compte ?' : 'Déjà un compte ?'}
                <button type="button" onClick={toggleAuthMode} className="switch-button">
                  {isLogin ? 'S\'inscrire' : 'Se connecter'}
                </button>
              </p>
            </div>

            <button 
              type="button" 
              onClick={() => setShowAuth(false)}
              className="back-button"
            >
              Retour
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
