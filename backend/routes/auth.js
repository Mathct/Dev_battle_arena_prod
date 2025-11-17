const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const router = express.Router();

// Variable pour stocker l'instance Socket.IO
let ioInstance = null;

// Fonction pour définir l'instance Socket.IO
const setSocketIO = (io) => {
  ioInstance = io;
};

// Fonction pour notifier tous les joueurs d'une mise à jour de leur statut d'équipe
async function notifyAllPlayersTeamStatus() {
  if (!ioInstance) {
    return;
  }

  try {
    ioInstance.emit('updateTeamStatus');
  } catch (error) {
    console.error('Erreur lors de la notification du statut d\'équipe:', error);
  }
}

// Configuration JWT
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here_change_this_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Route d'inscription
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation des données
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs sont requis'
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Nom d\'utilisateur ou email déjà utilisé'
      });
    }

    // Hacher le mot de passe
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Créer l'utilisateur
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    // Générer le token JWT
    const token = jwt.sign(
      { 
        userId: result.insertId, 
        username: username,
        email: email,
        role: 'user'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      message: 'Inscription réussie',
      token: token,
      user: {
        id: result.insertId,
        username: username,
        email: email,
        role: 'user'
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'inscription'
    });
  }
});

// Route de connexion
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation des données
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nom d\'utilisateur et mot de passe requis'
      });
    }

    // Rechercher l'utilisateur
    const [users] = await pool.execute(
      'SELECT id, username, email, password, role FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Nom d\'utilisateur ou mot de passe incorrect'
      });
    }

    const user = users[0];

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Nom d\'utilisateur ou mot de passe incorrect'
      });
    }

    // Générer le token JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Connexion réussie',
      token: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la connexion'
    });
  }
});

// Route pour récupérer tous les utilisateurs (admin seulement)
router.get('/users', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification requis'
      });
    }

    // Vérifier le token et le rôle admin
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Récupérer les informations de l'utilisateur pour vérifier son rôle
    const [users] = await pool.execute(
      'SELECT id, username, email, role FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const currentUser = users[0];
    
    // Vérifier que l'utilisateur est admin
    if (currentUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé - Rôle administrateur requis'
      });
    }

    // Récupérer tous les utilisateurs (sauf les mots de passe et les admins)
    const [allUsers] = await pool.execute(
      'SELECT id, username, email, role, created_at FROM users WHERE role != "admin" ORDER BY username ASC'
    );

    res.json({
      success: true,
      users: allUsers
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des utilisateurs'
    });
  }
});

// Route pour assigner les utilisateurs aux équipes
router.post('/assign-teams', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification requis'
      });
    }

    // Vérifier le token et le rôle admin
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Récupérer les informations de l'utilisateur pour vérifier son rôle
    const [users] = await pool.execute(
      'SELECT id, username, email, role FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const currentUser = users[0];
    
    // Vérifier que l'utilisateur est admin
    if (currentUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé - Rôle administrateur requis'
      });
    }

    const { team1, team2 } = req.body;

    // Validation des données
    if (!Array.isArray(team1) || !Array.isArray(team2)) {
      return res.status(400).json({
        success: false,
        message: 'Les équipes doivent être des tableaux'
      });
    }

    // Commencer une transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Supprimer toutes les assignations existantes
      await connection.execute('DELETE FROM teams');

      // Insérer les nouvelles assignations pour l'équipe 1
      for (const userId of team1) {
        await connection.execute(
          'INSERT INTO teams (user_id, team_name) VALUES (?, ?)',
          [userId, 'team1']
        );
      }

      // Insérer les nouvelles assignations pour l'équipe 2
      for (const userId of team2) {
        await connection.execute(
          'INSERT INTO teams (user_id, team_name) VALUES (?, ?)',
          [userId, 'team2']
        );
      }

      // Valider la transaction
      await connection.commit();

      // Notifier tous les joueurs de la mise à jour de leur statut d'équipe
      await notifyAllPlayersTeamStatus();

      res.json({
        success: true,
        message: 'Équipes assignées avec succès',
        team1: team1.length,
        team2: team2.length
      });

    } catch (error) {
      // Annuler la transaction en cas d'erreur
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Erreur lors de l\'assignation des équipes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'assignation des équipes'
    });
  }
});

// Route pour récupérer les équipes assignées
router.get('/teams', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification requis'
      });
    }

    // Vérifier le token et le rôle admin
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Récupérer les informations de l'utilisateur pour vérifier son rôle
    const [users] = await pool.execute(
      'SELECT id, username, email, role FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const currentUser = users[0];
    
    // Vérifier que l'utilisateur est admin
    if (currentUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé - Rôle administrateur requis'
      });
    }

    // Récupérer les équipes avec les informations des utilisateurs
    const [teams] = await pool.execute(`
      SELECT t.team_name, u.id, u.username, u.email 
      FROM teams t 
      JOIN users u ON t.user_id = u.id 
      ORDER BY t.team_name, u.username
    `);

    // Organiser les données par équipe
    const team1 = teams.filter(team => team.team_name === 'team1');
    const team2 = teams.filter(team => team.team_name === 'team2');

    res.json({
      success: true,
      teams: {
        team1,
        team2
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des équipes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des équipes'
    });
  }
});

// Route pour récupérer les scores des équipes
router.get('/scores', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification requis'
      });
    }

    // Vérifier le token et le rôle admin
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Récupérer les informations de l'utilisateur pour vérifier son rôle
    const [users] = await pool.execute(
      'SELECT id, username, email, role FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const currentUser = users[0];
    
    // Vérifier que l'utilisateur est admin
    if (currentUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé - Rôle administrateur requis'
      });
    }

    // Récupérer les scores des équipes
    const [scores] = await pool.execute(
      'SELECT team_name, score FROM scores ORDER BY team_name'
    );

    // Organiser les données par équipe
    const teamScores = {
      team1: scores.find(score => score.team_name === 'team1')?.score || 0,
      team2: scores.find(score => score.team_name === 'team2')?.score || 0
    };

    res.json({
      success: true,
      scores: teamScores
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des scores:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des scores'
    });
  }
});

// Route pour mettre à jour le score d'une équipe
router.put('/scores/:teamName', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { teamName } = req.params;
    const { score } = req.body;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification requis'
      });
    }

    // Vérifier le token et le rôle admin
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Récupérer les informations de l'utilisateur pour vérifier son rôle
    const [users] = await pool.execute(
      'SELECT id, username, email, role FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const currentUser = users[0];
    
    // Vérifier que l'utilisateur est admin
    if (currentUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé - Rôle administrateur requis'
      });
    }

    // Validation des données
    if (!['team1', 'team2'].includes(teamName)) {
      return res.status(400).json({
        success: false,
        message: 'Nom d\'équipe invalide'
      });
    }

    if (typeof score !== 'number' || score < 0) {
      return res.status(400).json({
        success: false,
        message: 'Score invalide'
      });
    }

    // Mettre à jour le score
    await pool.execute(
      'UPDATE scores SET score = ? WHERE team_name = ?',
      [score, teamName]
    );

    res.json({
      success: true,
      message: `Score de ${teamName} mis à jour`,
      teamName,
      score
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du score:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour du score'
    });
  }
});

// Route pour récupérer les utilisateurs qui ont buzzé
router.get('/buzzed-users', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT DISTINCT u.id, u.username 
      FROM users u 
      INNER JOIN playerbuzz pb ON u.id = pb.user_id
    `);
    
    res.json({ success: true, buzzedUsers: rows });
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs qui ont buzzé:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Route pour vérifier si un joueur est bloqué
router.get('/is-locked/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const [rows] = await pool.execute(
      'SELECT pb.id FROM playerbuzz pb INNER JOIN users u ON pb.user_id = u.id WHERE u.username = ?',
      [username]
    );
    
    res.json({ 
      success: true, 
      isLocked: rows.length > 0 
    });
  } catch (error) {
    console.error('Erreur lors de la vérification du statut de blocage:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Route pour vider la table playerbuzz
router.delete('/clear-buzzes', async (req, res) => {
  try {
    await pool.execute('DELETE FROM playerbuzz');
    res.json({ success: true, message: 'Table playerbuzz vidée avec succès' });
  } catch (error) {
    console.error('Erreur lors du vidage de la table playerbuzz:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Route pour bloquer un joueur spécifique (ajouter à la table playerbuzz)
router.post('/lock-player/:username', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { username } = req.params;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification requis'
      });
    }

    // Vérifier le token et le rôle admin
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Récupérer les informations de l'utilisateur pour vérifier son rôle
    const [users] = await pool.execute(
      'SELECT id, username, email, role FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const currentUser = users[0];
    
    // Vérifier que l'utilisateur est admin
    if (currentUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé - Rôle administrateur requis'
      });
    }

    // Récupérer l'ID de l'utilisateur à bloquer
    const [targetUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (targetUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Joueur non trouvé'
      });
    }

    const targetUserId = targetUsers[0].id;

    // Vérifier si le joueur est déjà bloqué
    const [existingLocks] = await pool.execute(
      'SELECT id FROM playerbuzz WHERE user_id = ?',
      [targetUserId]
    );

    if (existingLocks.length > 0) {
      return res.json({
        success: true,
        message: `Joueur ${username} est déjà bloqué`,
        isLocked: true
      });
    }

    // Ajouter le joueur à la table playerbuzz
    await pool.execute(
      'INSERT INTO playerbuzz (user_id) VALUES (?)',
      [targetUserId]
    );

    res.json({
      success: true,
      message: `Joueur ${username} bloqué avec succès`,
      isLocked: true
    });

  } catch (error) {
    console.error('Erreur lors du blocage du joueur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du blocage du joueur'
    });
  }
});

// Route pour débloquer un joueur spécifique (retirer de la table playerbuzz)
router.delete('/unlock-player/:username', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { username } = req.params;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token d\'authentification requis'
      });
    }

    // Vérifier le token et le rôle admin
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Récupérer les informations de l'utilisateur pour vérifier son rôle
    const [users] = await pool.execute(
      'SELECT id, username, email, role FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const currentUser = users[0];
    
    // Vérifier que l'utilisateur est admin
    if (currentUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé - Rôle administrateur requis'
      });
    }

    // Récupérer l'ID de l'utilisateur à débloquer
    const [targetUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (targetUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Joueur non trouvé'
      });
    }

    const targetUserId = targetUsers[0].id;

    // Vérifier si le joueur est bloqué
    const [existingLocks] = await pool.execute(
      'SELECT id FROM playerbuzz WHERE user_id = ?',
      [targetUserId]
    );

    if (existingLocks.length === 0) {
      return res.json({
        success: true,
        message: `Joueur ${username} n'est pas bloqué`,
        isLocked: false
      });
    }

    // Supprimer les entrées de playerbuzz pour ce joueur
    await pool.execute(
      'DELETE FROM playerbuzz WHERE user_id = ?',
      [targetUserId]
    );

    res.json({
      success: true,
      message: `Joueur ${username} débloqué avec succès`,
      isLocked: false
    });

  } catch (error) {
    console.error('Erreur lors du déblocage du joueur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du déblocage du joueur'
    });
  }
});

module.exports = router;
module.exports.setSocketIO = setSocketIO;
