const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const {
  KEYCLOAK_ISSUER,
  PGHOST,
  PGUSER,
  PGPASSWORD,
  PGDATABASE,
  PGPORT,
} = process.env;

// Initialize JWKS client
const client = jwksClient({
  jwksUri: `${KEYCLOAK_ISSUER}/protocol/openid-connect/certs`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        issuer: [
          KEYCLOAK_ISSUER,
          KEYCLOAK_ISSUER.replace('keycloak', 'localhost')
        ],
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded);
      }
    );
  });
}

// Database setup
const pool = new Pool({
  host: PGHOST,
  user: PGUSER,
  password: PGPASSWORD,
  database: PGDATABASE,
  port: PGPORT
});

// Run migrations
(async () => {
  try {
    const migrations = [
      fs.readFileSync(path.join(__dirname, 'migrations', '001_create_users_table.sql'), 'utf-8'),
      fs.readFileSync(path.join(__dirname, 'migrations', '002_create_game_state_table.sql'), 'utf-8')
    ];
    
    const client = await pool.connect();
    try {
      for (const migration of migrations) {
        await client.query(migration);
      }
      console.log('Migrations ran successfully.');
      
      // Load current layer from database
      currentLayer = await getCurrentLayer();
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error during initialization:', err);
    process.exit(1);
  }
})().catch((err) => {
  console.error('Unexpected error during initialization:', err);
  process.exit(1);
});

// Basic database functions
async function getLeaderboard() {
  const { rows } = await pool.query(
    'SELECT id, username, points FROM users ORDER BY points DESC LIMIT 10'
  );
  return rows;
}

async function getUserData(userId) {
  const { rows } = await pool.query(
    'SELECT id, username, points, owned_upgrades FROM users WHERE id=$1',
    [userId]
  );
  if (rows.length > 0) return rows[0];

  await pool.query('INSERT INTO users (id) VALUES ($1)', [userId]);
  return { id: userId, username: null, points: 0, owned_upgrades: [] };
}

async function updateUserData(userId, data) {
  await pool.query(
    'UPDATE users SET points=$1, owned_upgrades=$2 WHERE id=$3',
    [data.points, data.owned_upgrades, userId]
  );
}

async function getCurrentLayer() {
  const { rows } = await pool.query(
    'SELECT current_layer FROM game_state WHERE id=1'
  );
  return rows[0]?.current_layer || 1;
}

async function incrementLayer() {
  const { rows } = await pool.query(
    'UPDATE game_state SET current_layer = current_layer + 1 WHERE id=1 RETURNING current_layer'
  );
  return rows[0].current_layer;
}

// Cube logic
const GRID_SIZE = 4;

function createFace() {
  return Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(true));
}

function generateColor() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = Math.floor(Math.random() * 30 + 60);
  const lightness = Math.floor(Math.random() * 20 + 45);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function createLayer(color) {
  return {
    front: createFace(),
    back: createFace(),
    top: createFace(),
    bottom: createFace(),
    left: createFace(),
    right: createFace(),
    color: color || generateColor(),
  };
}

function isLayerComplete(layer) {
  return ['front', 'back', 'top', 'bottom', 'left', 'right'].every(face =>
    layer[face].every(row => row.every(block => !block))
  );
}

// Initial state
let layers = [createLayer(), createLayer()];
let currentLayer;

// Server setup
const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication token missing'));

  try {
    const decoded = await verifyToken(token);
    socket.userId = decoded.sub;
    socket.userData = await getUserData(socket.userId);
    next();
  } catch (err) {
    next(new Error('Invalid authentication token'));
  }
});

// Socket events
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId}`);

  socket.emit('cubeStateUpdate', layers);
  socket.emit('userData', {
    points: socket.userData.points,
    ownedUpgrades: socket.userData.owned_upgrades
  });
  socket.emit('currentLayer', currentLayer);

  socket.on('removeBlock', async ({ face, row, col }) => {
    if (layers[0][face][row][col]) {
      // Remove the block
      layers[0][face][row][col] = false;
      
      // Check if layer is complete
      if (isLayerComplete(layers[0])) {
        // Move second layer up and create new bottom layer
        layers = [layers[1], createLayer()];
        currentLayer = await incrementLayer();
        io.emit('currentLayer', currentLayer);
      }

      // Send updated state to all clients
      io.emit('cubeStateUpdate', layers);
    }
  });

  socket.on('nukeLayer', async () => {
    if (socket.userData.owned_upgrades.includes('nuker')) {
      // Count blocks for points
      let blockCount = 0;
      Object.keys(layers[0]).forEach(face => {
        if (Array.isArray(layers[0][face])) {
          layers[0][face].forEach(row => {
            row.forEach(block => {
              if (block) blockCount++;
            });
          });
        }
      });
      
      // Calculate points (1 point per block, multiplied by any double point upgrades)
      let pointsEarned = blockCount;
      if (socket.userData.owned_upgrades.includes('double')) pointsEarned *= 2;
      if (socket.userData.owned_upgrades.includes('doublePro')) pointsEarned *= 2;
      if (socket.userData.owned_upgrades.includes('doubleMax')) pointsEarned *= 2;
      
      // Add points
      socket.userData.points += pointsEarned;
      await updateUserData(socket.userId, socket.userData);
      
      // Clear all blocks in the top layer
      Object.keys(layers[0]).forEach(face => {
        if (Array.isArray(layers[0][face])) {
          layers[0][face] = layers[0][face].map(row => 
            row.map(() => false)
          );
        }
      });
      
      // Move second layer up and create new bottom layer
      layers = [layers[1], createLayer()];
      currentLayer = await incrementLayer();
      
      // Send updated state to all clients
      io.emit('cubeStateUpdate', layers);
      io.emit('currentLayer', currentLayer);
      socket.emit('userData', {
        points: socket.userData.points,
        ownedUpgrades: socket.userData.owned_upgrades
      });

      // Update leaderboard
      const leaderboard = await getLeaderboard();
      io.emit('leaderboardUpdate', leaderboard);
    }
  });

  socket.on('updatePoints', async ({ points }) => {
    socket.userData.points += points;
    await updateUserData(socket.userId, socket.userData);
    
    socket.emit('userData', {
      points: socket.userData.points,
      ownedUpgrades: socket.userData.owned_upgrades
    });

    const leaderboard = await getLeaderboard();
    io.emit('leaderboardUpdate', leaderboard);
  });

  socket.on('requestLeaderboard', async () => {
    try {
      const leaderboard = await getLeaderboard();
      socket.emit('leaderboardUpdate', leaderboard);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    }
  });

  socket.on('updateUsername', async (username) => {
    try {
      await pool.query(
        'UPDATE users SET username = $1 WHERE id = $2',
        [username, socket.userId]
      );
    } catch (err) {
      console.error('Error updating username:', err);
    }
  });

  socket.on('purchaseUpgrade', async ({ upgrade }) => {
    try {
      const user = socket.userData;
      const costs = {
        double: 50,
        doublePro: 1000,
        doubleMax: 2000,
        autoClicker: 100,
        autoClickerFast: 500,
        autoClickerUltra: 10000,
        nuker: 1000000
      };
      const cost = costs[upgrade] || 0;

      if (user.points >= cost && !user.owned_upgrades.includes(upgrade)) {
        user.points -= cost;
        user.owned_upgrades.push(upgrade);
        
        await updateUserData(socket.userId, user);
        
        socket.emit('userData', {
          points: user.points,
          ownedUpgrades: user.owned_upgrades
        });

        const leaderboard = await getLeaderboard();
        io.emit('leaderboardUpdate', leaderboard);
      }
    } catch (err) {
      console.error('Purchase error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.userId}`);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
