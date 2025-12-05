// Fichier principal du serveur backend
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const http = require('http');
const { 
  pool,
  createDatabase, 
  testConnection, 
  createUsersTable,
  createTeamsTable,
  createGameTable,
  createScoresTable,
  createPlayerbuzzTable
} = require('./config/database');

// Charger les variables d'environnement
dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000; // Port par défaut

// Configuration Socket.IO pour la production
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*", // URL du frontend en production
    methods: ["GET", "POST"],
    credentials: true
  },
  // Configuration pour la production (cPanel, proxies, etc.)
  // Polling en premier pour éviter les problèmes avec les reverse proxies
  transports: ['polling', 'websocket'], // Polling d'abord (plus compatible avec les proxies)
  allowEIO3: true, // Compatibilité avec les anciennes versions
  pingTimeout: 60000, // 60 secondes
  pingInterval: 25000, // 25 secondes
  // Important pour les reverse proxies (cPanel)
  allowUpgrades: true,
  upgradeTimeout: 10000,
  // Path pour Socket.IO (si nécessaire derrière un proxy)
  path: '/socket.io/',
  // Gérer les connexions multiples
  maxHttpBufferSize: 1e6, // 1MB
  // Support pour les proxies
  httpCompression: true,
  // Permettre les connexions cross-origin
  serveClient: false
});

// Exporter l'instance Socket.IO pour les routes
module.exports.io = io;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware d'authentification
const { authenticate, requireAdmin } = require('./middleware/auth');


// Routes d'authentification
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Configurer Socket.IO pour les routes d'authentification
authRoutes.setSocketIO(io);

// Route de base
app.get('/', (req, res) => {
  res.json({ 
    message: 'Bienvenue sur l\'API DEV BATTLE ARENA',
    version: '1.0.0',
    status: 'running'
  });
});

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Route de diagnostic de la base de données
app.get('/api/debug/db', async (req, res) => {
  try {
    const { testConnection } = require('./config/database');
    const result = await testConnection();
    
    res.json({
      ...result,
      config: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        database: process.env.DB_NAME || 'dev_battle_arena_db',
        password: process.env.DB_PASSWORD ? '***' : '(non défini)'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erreur lors du test de connexion',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne',
      config: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        database: process.env.DB_NAME || 'dev_battle_arena_db'
      }
    });
  }
});

// Route API pour les données (protégée - authentification requise)
app.get('/api/data', authenticate, (req, res) => {
  res.json({ 
    message: 'Données DEV BATTLE ARENA',
    users: io.engine.clientsCount,
    timestamp: new Date().toISOString()
  });
});

// Route pour obtenir l'état du jeu (protégée - authentification requise)
app.get('/api/game/state', authenticate, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT game_state FROM game ORDER BY id DESC LIMIT 1');
    connection.release();
    
    const gameState = rows.length > 0 ? rows[0].game_state : 0;
    res.json({ success: true, gameState, buzzersEnabled });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'état du jeu:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Route pour modifier l'état du jeu (admin seulement)
app.post('/api/game/state', authenticate, requireAdmin, async (req, res) => {
  try {
    const { gameState } = req.body;
    
    if (gameState !== 0 && gameState !== 1) {
      return res.status(400).json({ success: false, message: 'État de jeu invalide' });
    }
    
    const connection = await pool.getConnection();
    await connection.execute('UPDATE game SET game_state = ? WHERE id = (SELECT id FROM (SELECT id FROM game ORDER BY id DESC LIMIT 1) as subquery)', [gameState]);
    connection.release();
    
    // Si la partie s'arrête, désactiver les buzzers et reset le buzzer
    if (gameState === 0) {
      buzzersEnabled = false;
      buzzedPlayer = null; // Annuler le buzz en cours
      
      // Reset tous les joueurs
      players.forEach((player) => {
        player.buzzed = false;
        players.set(player.name, player);
      });
      
      console.log('🛑 Partie arrêtée - Désactivation des buzzers et reset du buzzer');
      // Notifier tous les clients que les buzzers sont désactivés et reset le buzzer
      io.emit('buzzersStateChanged', { enabled: false });
      io.emit('buzzerReset');
    }
    
    // Notifier tous les clients du changement d'état
    io.emit('gameStateChanged', { gameState });
    
    res.json({ success: true, gameState });
  } catch (error) {
    console.error('Erreur lors de la modification de l\'état du jeu:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// Stockage des joueurs connectés (clé = nom d'utilisateur)
const players = new Map();
let buzzedPlayer = null;
let buzzersEnabled = false; // État global des buzzers
let serverCountdown = 0;
let countdownInterval = null;
let countdownStartAt = null;

// Fonction pour vérifier si un joueur est dans une équipe
async function isPlayerInTeam(playerName) {
  try {
    const result = await pool.query(
      'SELECT team_name FROM teams WHERE user_id = (SELECT id FROM users WHERE username = ?)',
      [playerName]
    );
    return result[0].length > 0;
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'équipe:', error);
    return false;
  }
}

// Fonction pour récupérer le nom de l'équipe d'un joueur
async function getPlayerTeamName(playerName) {
  try {
    const result = await pool.query(
      'SELECT team_name FROM teams WHERE user_id = (SELECT id FROM users WHERE username = ?)',
      [playerName]
    );
    if (result[0].length > 0) {
      return result[0][0].team_name; // 'team1' ou 'team2'
    }
    return null;
  } catch (error) {
    console.error('Erreur lors de la récupération du nom de l\'équipe:', error);
    return null;
  }
}

// Fonction pour vérifier si un joueur est bloqué (dans la table playerbuzz)
async function isPlayerLocked(playerName) {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT pb.id FROM playerbuzz pb INNER JOIN users u ON pb.user_id = u.id WHERE u.username = ?',
      [playerName]
    );
    connection.release();
    return rows.length > 0;
  } catch (error) {
    console.error('Erreur lors de la vérification du blocage du joueur:', error);
    return false;
  }
}

// Fonction pour notifier tous les joueurs d'une mise à jour de leur statut d'équipe
async function notifyAllPlayersTeamStatus() {
  try {
    const playersList = Array.from(players.values());
    for (const player of playersList) {
      const isInTeam = await isPlayerInTeam(player.name);
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) {
        playerSocket.emit('teamStatus', { isInTeam });
      }
    }
  } catch (error) {
    console.error('Erreur lors de la notification du statut d\'équipe:', error);
  }
}

// Fonction pour démarrer le chrono côté serveur
function startServerCountdown(duration = 5.0) {
  // Arrêter le chrono existant s'il y en a un
  stopServerCountdown();
  
  serverCountdown = duration;
  console.log(`⏱️ Chrono serveur démarré: ${duration} secondes`);
  
  // Envoyer le chrono initial à tous les clients
  io.emit('countdownUpdate', { countdown: serverCountdown });
  
  countdownInterval = setInterval(() => {
    serverCountdown -= 0.01;
    
    if (serverCountdown <= 0) {
      serverCountdown = 0;
      stopServerCountdown();
      console.log('⏱️ Chrono serveur terminé');
    }
    
    // Envoyer le chrono à tous les clients
    io.emit('countdownUpdate', { countdown: serverCountdown });
  }, 10); // Mise à jour toutes les 10ms
}

// Fonction pour arrêter le chrono côté serveur
function stopServerCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  
  if (serverCountdown > 0) {
    serverCountdown = 0;
    console.log('⏱️ Chrono serveur arrêté');
    
    // Envoyer l'arrêt du chrono à tous les clients
    io.emit('countdownUpdate', { countdown: 0 });
  }
}

// Gestion des connexions Socket.IO
io.on('connection', (socket) => {
  console.log(`Utilisateur connecté: ${socket.id}`);
  console.log(`Total utilisateurs connectés: ${io.engine.clientsCount}`);
  
  // Rejoindre le jeu
  socket.on('joinGame', async (playerName, isAdmin = false) => {
    if (isAdmin) {
      // Les admins ne sont pas ajoutés à la liste des joueurs
      console.log(`👑 ${playerName} (Admin) connecté au serveur`);
      // Envoyer la liste actuelle des joueurs à l'admin
      const playersList = Array.from(players.values());
      socket.emit('playersUpdate', playersList);
      
      // Envoyer l'état actuel du buzzer à l'admin
      if (buzzedPlayer) {
         // S'assurer que le nom de l'équipe est présent
         const teamName = buzzedPlayer.teamName || await getPlayerTeamName(buzzedPlayer.name);
         const buzzedPlayerWithTeam = {
           ...buzzedPlayer,
           teamName: teamName || null
         };
         socket.emit('playerBuzzed', buzzedPlayerWithTeam);
        console.log(`📡 État du buzzer envoyé à l'admin: ${buzzedPlayer.name} a buzzé`);
      }
      
      console.log(`📡 Liste des joueurs envoyée à l'admin:`, playersList.map(p => p.name));
    } else {
      // Utiliser le nom d'utilisateur comme clé unique pour les joueurs normaux
      const player = {
        id: socket.id,
        name: playerName,
        buzzed: false,
        isAdmin: false
      };
      
      if (players.has(playerName)) {
        console.log(`🔄 ${playerName} s'est reconnecté (remplacement)`);
        
        // Récupérer l'ancien joueur pour préserver son état
        const oldPlayer = players.get(playerName);
        if (oldPlayer) {
          player.buzzed = oldPlayer.buzzed; // Préserver l'état buzzed
          console.log(`🔄 ${playerName} - état buzzed préservé: ${player.buzzed}`);
          
          // Si c'est le joueur qui a buzzé qui se reconnecte, mettre à jour buzzedPlayer global
          if (buzzedPlayer && buzzedPlayer.name === playerName) {
            buzzedPlayer.id = socket.id; // Mettre à jour le socket.id
            buzzedPlayer.buzzed = true;
            console.log(`🔄 Mise à jour du buzzedPlayer global pour ${playerName} avec nouveau socket.id: ${socket.id}`);
          }
        }
      } else {
        console.log(`🎮 ${playerName} a rejoint le jeu`);
      }
      
      players.set(playerName, player);
      
      // Émettre l'événement de connexion
      io.emit('playerConnected', playerName);
      
      // Vérifier si le joueur est dans une équipe et envoyer l'information
      const isInTeam = await isPlayerInTeam(playerName);
      const teamName = await getPlayerTeamName(playerName);
      socket.emit('teamStatus', { isInTeam, teamName });
      
      // Notifier tous les clients de la mise à jour des joueurs
      const playersList = Array.from(players.values());
      io.emit('playersUpdate', playersList);
      
      // Si quelqu'un a buzzé, envoyer l'état à tous les joueurs
      if (buzzedPlayer) {
        // S'assurer que le nom de l'équipe est présent
        const teamName = buzzedPlayer.teamName || await getPlayerTeamName(buzzedPlayer.name);
        const buzzedPlayerWithTeam = {
          ...buzzedPlayer,
          teamName: teamName || null
        };
        io.emit('playerBuzzed', buzzedPlayerWithTeam);
        
        // Si c'est le joueur qui a buzzé qui se reconnecte, forcer l'envoi de l'état
        if (buzzedPlayer.name === playerName) {
          setTimeout(async () => {
            const teamNameRetry = buzzedPlayer.teamName || await getPlayerTeamName(buzzedPlayer.name);
            const buzzedPlayerWithTeamRetry = {
              ...buzzedPlayer,
              teamName: teamNameRetry || null
            };
            io.emit('playerBuzzed', buzzedPlayerWithTeamRetry);
          }, 100);
        }
      }
    }
  });

  // Buzzer
  socket.on('buzz', async () => {
    if (buzzedPlayer) {
      console.log(`Tentative de buzzer mais ${buzzedPlayer.name} a déjà buzzé`);
      return;
    }

     if (countdownStartAt && Date.now() - countdownStartAt < 100) {
      console.log(`🚫 Buzz trop rapide ignoré (<50ms) par ${socket.id}`);
      return;
    }

    // Trouver le joueur par socket.id
    const player = Array.from(players.values()).find(p => p.id === socket.id);
    if (player && !player.buzzed) {
      // Vérifier si le joueur est dans une équipe
      const isInTeam = await isPlayerInTeam(player.name);
      if (!isInTeam) {
        console.log(`❌ ${player.name} ne peut pas buzzer car il n'est pas dans une équipe`);
        socket.emit('buzzerError', { message: 'Vous devez être dans une équipe pour pouvoir buzzer' });
        return;
      }

      // Vérifier si le joueur est bloqué
      const isLocked = await isPlayerLocked(player.name);
      if (isLocked) {
        console.log(`🔒 ${player.name} ne peut pas buzzer car il est bloqué`);
        // Retourner silencieusement sans alerte
        return;
      }

      // Récupérer le nom de l'équipe du joueur
      const teamName = await getPlayerTeamName(player.name);
      
      buzzedPlayer = {
        ...player,
        teamName: teamName || null
      };
      player.buzzed = true;
      player.teamName = teamName || null;
      players.set(player.name, player);
      
      console.log(`${player.name} a buzzé !`);
      
      // Insérer l'id du joueur dans la table playerbuzz
      try {
        const connection = await pool.getConnection();
        // Récupérer l'id de l'utilisateur depuis la table users
        const [userRows] = await connection.execute('SELECT id FROM users WHERE username = ?', [player.name]);
        if (userRows.length > 0) {
          const userId = userRows[0].id;
          await connection.execute('INSERT INTO playerbuzz (user_id) VALUES (?)', [userId]);
          console.log(`📝 Id du joueur ${player.name} (user_id: ${userId}) inséré dans playerbuzz`);
        } else {
          console.log(`⚠️ Utilisateur ${player.name} non trouvé dans la table users`);
        }
        connection.release();
      } catch (error) {
        console.error('❌ Erreur lors de l\'insertion dans playerbuzz:', error.message);
      }
      
      // Arrêter le chrono côté serveur
      buzzersEnabled = false;
      stopServerCountdown();
      console.log(`⏱️ Chrono serveur arrêté automatiquement après buzz de ${player.name}`);
      
      // Notifier tous les clients
      io.emit('playerBuzzed', buzzedPlayer);
      io.emit('buzzersStateChanged', { enabled: false });
      
      const playersList = Array.from(players.values());
      io.emit('playersUpdate', playersList);
      console.log(`📡 Liste des joueurs envoyée après buzzer:`, playersList.map(p => ({ name: p.name, buzzed: p.buzzed })));
    } else if (player && player.buzzed) {
      console.log(`${player.name} a déjà buzzé dans cette manche`);
    } else {
      console.log(`⚠️ Joueur non trouvé pour socket.id: ${socket.id}`);
      console.log(`📋 Joueurs disponibles:`, Array.from(players.values()).map(p => ({ name: p.name, id: p.id })));
    }
  });

  // Reset du buzzer
  socket.on('resetBuzzer', async () => {
    const lastBuzzed = buzzedPlayer ? { ...buzzedPlayer } : null;
    buzzedPlayer = null;
    // Reset tous les joueurs
    players.forEach((player) => {
      player.buzzed = false;
      players.set(player.name, player);
    });

    // Débloquer le joueur qui avait buzzé (supprimer son entrée dans playerbuzz)
    // ATTENTION: Attendre que le DELETE soit terminé avant d'émettre l'événement
      try {
        if (lastBuzzed && lastBuzzed.name) {
          const connection = await pool.getConnection();
          await connection.execute(
            'DELETE FROM playerbuzz WHERE user_id = (SELECT id FROM users WHERE username = ?)',
            [lastBuzzed.name]
          );
          connection.release();
          console.log(`🔓 Joueur débloqué après reset: ${lastBuzzed.name}`);
        } else {
          // Optionnel: ne rien faire si aucun joueur n'était enregistré
          console.log('ℹ️ Aucun joueur à débloquer lors du reset');
        }
      } catch (error) {
        console.error('❌ Erreur lors du déblocage du joueur après reset:', error);
      }
    
    // Émettre l'événement APRÈS que le DELETE soit terminé
    console.log(`Buzzer reset`);
    io.emit('buzzerReset');
    const playersList = Array.from(players.values());
    io.emit('playersUpdate', playersList);
    console.log(`📡 Liste des joueurs envoyée après reset:`, playersList.map(p => ({ name: p.name, buzzed: p.buzzed })));
  });

  // Fin de manche SANS déblocage (utilisé pour Valider/Refuser la réponse)
  socket.on('endRoundNoUnlock', () => {
    buzzedPlayer = null;
    // Reset tous les joueurs
    players.forEach((player) => {
      player.buzzed = false;
      players.set(player.name, player);
    });

    console.log(`Fin de manche (sans déblocage)`);
    io.emit('buzzerReset'); // réutiliser le même évènement côté clients
    const playersList = Array.from(players.values());
    io.emit('playersUpdate', playersList);
    console.log(`📡 Liste des joueurs envoyée après fin de manche:`, playersList.map(p => ({ name: p.name, buzzed: p.buzzed })));
  });

  // Gestion de l'état des buzzers
  socket.on('buzzersStateChanged', (data) => {
    console.log(`🔔 État des buzzers changé: ${data.enabled ? 'activés' : 'désactivés'}`);
    buzzersEnabled = data.enabled; // Mettre à jour l'état global
    
    // Gérer le chrono côté serveur
    if (data.enabled) {
      countdownStartAt = Date.now();
      startServerCountdown(5.0); // Démarrer le chrono de 5 secondes
    } else {
      countdownStartAt = null;
      stopServerCountdown(); // Arrêter le chrono
    }
    
    console.log(`📡 Diffusion de l'état des buzzers à tous les clients...`);
    // Diffuser l'état des buzzers à tous les clients
    io.emit('buzzersStateChanged', { enabled: data.enabled });
    console.log(`✅ État des buzzers diffusé avec succès`);
  });

  // Vérification du statut d'équipe pour un joueur spécifique
  socket.on('checkTeamStatus', async () => {
    const player = Array.from(players.values()).find(p => p.id === socket.id);
    if (player) {
      const isInTeam = await isPlayerInTeam(player.name);
      const teamName = await getPlayerTeamName(player.name);
      socket.emit('teamStatusResponse', { isInTeam, teamName });
    }
  });

  // Gestion du chrono
  socket.on('countdownUpdate', (data) => {
    console.log(`⏱️ Chrono reçu: ${data.countdown}`);
    console.log(`📡 Diffusion du chrono à tous les clients...`);
    // Diffuser le chrono à tous les clients
    io.emit('countdownUpdate', { countdown: data.countdown });
    console.log(`✅ Chrono diffusé avec succès`);
  });



  // Gérer la déconnexion
  socket.on('disconnect', () => {
    console.log(`🔌 Déconnexion détectée pour socket: ${socket.id}`);
    
    // Trouver le joueur par socket.id
    const player = Array.from(players.values()).find(p => p.id === socket.id);
    if (player) {
      console.log(`👋 ${player.name} a quitté le jeu`);
      
      // Si le joueur qui a buzzé se déconnecte, ne pas reset (il peut se reconnecter)
      if (buzzedPlayer && buzzedPlayer.id === socket.id) {
        console.log(`⚠️ Le joueur qui a buzzé (${buzzedPlayer.name}) s'est déconnecté - état préservé`);
        // Ne pas supprimer le joueur de la liste s'il a buzzé
        return;
      }
      
      // Supprimer le joueur de la liste
      players.delete(player.name);
      console.log(`📋 Liste des joueurs après suppression:`, Array.from(players.values()).map(p => p.name));
      
      // Émettre l'événement de déconnexion
      io.emit('playerDisconnected', player.name);
      
      // Mettre à jour la liste des joueurs
      const playersList = Array.from(players.values());
      io.emit('playersUpdate', playersList);
      console.log(`📡 Liste des joueurs envoyée après déconnexion:`, playersList.map(p => ({ name: p.name, buzzed: p.buzzed })));
    } else {
      console.log(`⚠️ Aucun joueur trouvé avec l'ID socket: ${socket.id}`);
    }
    
    console.log(`📊 Total utilisateurs connectés: ${io.engine.clientsCount}`);
  });
});

// // Initialiser la base de données et démarrer le serveur
// async function startServer() {
//   try {
//     // Créer la base de données si elle n'existe pas
//     const dbCreated = await createDatabase();
//     if (!dbCreated) {
//       console.error('❌ Impossible de créer la base de données');
//       process.exit(1);
//     }

//     // Tester la connexion à la base de données
//     const dbConnected = await testConnection();
//     if (!dbConnected) {
//       console.error('❌ Impossible de se connecter à la base de données');
//       process.exit(1);
//     }

//     // Créer toutes les tables si elles n'existent pas
//     const usersTableCreated = await createUsersTable();
//     if (!usersTableCreated) {
//       console.error('❌ Impossible de créer la table users');
//       process.exit(1);
//     }

//     const teamsTableCreated = await createTeamsTable();
//     if (!teamsTableCreated) {
//       console.error('❌ Impossible de créer la table teams');
//       process.exit(1);
//     }

//     const gameTableCreated = await createGameTable();
//     if (!gameTableCreated) {
//       console.error('❌ Impossible de créer la table game');
//       process.exit(1);
//     }

//     const scoresTableCreated = await createScoresTable();
//     if (!scoresTableCreated) {
//       console.error('❌ Impossible de créer la table scores');
//       process.exit(1);
//     }

//     const playerbuzzTableCreated = await createPlayerbuzzTable();
//     if (!playerbuzzTableCreated) {
//       console.error('❌ Impossible de créer la table playerbuzz');
//       process.exit(1);
//     }

//     // Démarrer le serveur
//     server.listen(PORT, () => {
//       console.log(`Serveur DEV BATTLE ARENA démarré sur le port ${PORT}`);
//       console.log(`URL: http://localhost:${PORT}`);
//       console.log(`Environnement: ${process.env.NODE_ENV || 'development'}`);
//       console.log(`Système DEV BATTLE ARENA prêt !`);
//     });
//   } catch (error) {
//     console.error('❌ Erreur lors du démarrage du serveur:', error);
//     process.exit(1);
//   }
// }

async function startServer() {
  server.listen(PORT, () => {
    console.log(`Serveur DEV BATTLE ARENA démarré sur le port ${PORT}`);
  });
}

startServer();

// Exporter la fonction de notification pour les routes
module.exports.notifyAllPlayersTeamStatus = notifyAllPlayersTeamStatus;
module.exports = app;
