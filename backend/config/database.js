const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuration de la base de données
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dev_battle_arena_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Configuration pour la production - gestion des connexions perdues
  reconnect: true,
  acquireTimeout: 60000, // 60 secondes pour obtenir une connexion
  timeout: 60000, // 60 secondes de timeout pour les requêtes
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Gestion des erreurs de connexion
  multipleStatements: false,
  // Support des timezones
  timezone: 'local'
};

// Configuration sans base de données spécifique pour créer la DB
const dbConfigWithoutDB = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Créer le pool de connexions
const pool = mysql.createPool(dbConfig);

// Gestion des erreurs du pool
pool.on('connection', (connection) => {
  console.log('✅ Nouvelle connexion MySQL établie');
  
  // Gérer les erreurs de connexion
  connection.on('error', (err) => {
    console.error('❌ Erreur MySQL sur la connexion:', err.code);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
      console.log('🔄 Reconnexion automatique...');
    }
  });
});

pool.on('acquire', (connection) => {
  // Vérifier si la connexion est toujours valide avant de l'utiliser
  connection.ping((err) => {
    if (err) {
      console.warn('⚠️ Connexion invalide détectée, reconnexion...');
    }
  });
});

// Fonction pour créer la base de données si elle n'existe pas
async function createDatabase() {
  try {
    const tempPool = mysql.createPool(dbConfigWithoutDB);
    const connection = await tempPool.getConnection();
    
    const dbName = process.env.DB_NAME || 'dev_battle_arena_db';
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    
    console.log(`✅ Base de données '${dbName}' créée ou vérifiée avec succès`);
    connection.release();
    await tempPool.end();
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la création de la base de données:', error.message);
    return false;
  }
}

// Fonction pour tester la connexion
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    // Tester la connexion avec une requête simple
    await connection.execute('SELECT 1');
    console.log('✅ Connexion à la base de données réussie');
    connection.release();
    return { success: true, message: 'Connexion OK' };
  } catch (error) {
    console.error('❌ Erreur de connexion à la base de données:', error.message);
    console.error('❌ Code d\'erreur:', error.code);
    return { 
      success: false, 
      message: error.message,
      code: error.code || 'UNKNOWN',
      config: {
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        database: dbConfig.database
      }
    };
  }
}

// Fonction pour créer la table users si elle n'existe pas
async function createUsersTable() {
  try {
    const connection = await pool.getConnection();
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('user', 'admin') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createTableQuery);
    console.log('✅ Table users créée ou vérifiée avec succès');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la création de la table users:', error.message);
    return false;
  }
}

// Fonction pour créer la table teams si elle n'existe pas
async function createTeamsTable() {
  try {
    const connection = await pool.getConnection();
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS teams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        team_name VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createTableQuery);
    console.log('✅ Table teams créée ou vérifiée avec succès');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la création de la table teams:', error.message);
    return false;
  }
}

// Fonction pour créer la table game si elle n'existe pas
async function createGameTable() {
  try {
    const connection = await pool.getConnection();
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS game (
        id INT AUTO_INCREMENT PRIMARY KEY,
        game_state INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createTableQuery);
    
    // Vérifier si un enregistrement existe, sinon en créer un
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM game');
    if (rows[0].count === 0) {
      await connection.execute('INSERT INTO game (game_state) VALUES (0)');
      console.log('✅ Enregistrement de jeu initial créé avec game_state = 0');
    }
    
    console.log('✅ Table game créée ou vérifiée avec succès');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la création de la table game:', error.message);
    return false;
  }
}

// Fonction pour créer la table scores si elle n'existe pas
async function createScoresTable() {
  try {
    const connection = await pool.getConnection();
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS scores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_name VARCHAR(50) UNIQUE NOT NULL,
        score INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createTableQuery);
    
    // Vérifier si les équipes existent, sinon les créer avec score 0
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM scores');
    if (rows[0].count === 0) {
      await connection.execute('INSERT INTO scores (team_name, score) VALUES ("team1", 0)');
      await connection.execute('INSERT INTO scores (team_name, score) VALUES ("team2", 0)');
      console.log('✅ Scores des équipes initialisés à 0');
    }
    
    console.log('✅ Table scores créée ou vérifiée avec succès');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la création de la table scores:', error.message);
    return false;
  }
}

// Fonction pour créer la table playerbuzz si elle n'existe pas
async function createPlayerbuzzTable() {
  try {
    const connection = await pool.getConnection();
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS playerbuzz (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `;
    
    await connection.execute(createTableQuery);
    console.log('✅ Table playerbuzz créée ou vérifiée avec succès');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la création de la table playerbuzz:', error.message);
    return false;
  }
}




// Fonction wrapper pour exécuter des requêtes avec gestion automatique des reconnexions
async function executeQuery(query, params = []) {
  let retries = 3;
  let lastError;
  
  while (retries > 0) {
    try {
      const [rows] = await pool.execute(query, params);
      return rows;
    } catch (error) {
      lastError = error;
      
      // Codes d'erreur qui nécessitent une reconnexion
      if (error.code === 'PROTOCOL_CONNECTION_LOST' || 
          error.code === 'ECONNRESET' || 
          error.code === 'ETIMEDOUT' ||
          error.code === 'PROTOCOL_ENQUEUE_AFTER_QUIT') {
        console.warn(`⚠️ Erreur de connexion (${error.code}), nouvelle tentative... (${retries - 1} tentatives restantes)`);
        retries--;
        // Attendre un peu avant de réessayer
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      
      // Si ce n'est pas une erreur de connexion, relancer l'erreur
      throw error;
    }
  }
  
  // Si toutes les tentatives ont échoué, relancer l'erreur
  throw lastError;
}

module.exports = {
  pool,
  executeQuery,
  createDatabase,
  testConnection,
  createUsersTable,
  createTeamsTable,
  createGameTable,
  createScoresTable,
  createPlayerbuzzTable
};
