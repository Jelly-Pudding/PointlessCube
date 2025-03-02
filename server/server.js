// server.js

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
  KEYCLOAK_PUBLIC_ISSUER,
  KEYCLOAK_INTERNAL_JWKS_URI,
  PGHOST,
  PGUSER,
  PGPASSWORD,
  PGDATABASE,
  PGPORT
} = process.env;

// Log the issuer and JWKS for debugging:
console.log('Using Keycloak Public Issuer:', KEYCLOAK_PUBLIC_ISSUER);
console.log('Internal JWKS URL:', KEYCLOAK_INTERNAL_JWKS_URI);

// Initialize JWKS client with the internal Keycloak URL
const client = jwksClient({
  jwksUri: KEYCLOAK_INTERNAL_JWKS_URI
});

function getKey(header, callback) {
  console.log('Getting signing key for kid:', header.kid);
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error('Error getting signing key:', err);
      return callback(err);
    }
    const signingKey = key.getPublicKey();
    console.log('Got signing key successfully');
    callback(null, signingKey);
  });
}

function verifyToken(token) {
  return new Promise((resolve, reject) => {
    console.log('Verifying token...');
    jwt.verify(
      token,
      getKey,
      {
        // The token's "iss" claim must match your public Keycloak issuer
        issuer: [KEYCLOAK_PUBLIC_ISSUER],
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err) {
          console.error('Token verification failed:', err);
          return reject(err);
        }
        console.log('Token verified successfully for user:', decoded.sub);
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

// Increase cube grid size to 64
const GRID_SIZE = 64;

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

function isCubeStateValid(cubeLayers) {
  return (
    Array.isArray(cubeLayers) &&
    cubeLayers.length > 0 &&
    cubeLayers[0].front &&
    cubeLayers[0].front.length === GRID_SIZE
  );
}

// Run migrations and initialize cube state
(async () => {
  try {
    const migrations = [
      fs.readFileSync(path.join(__dirname, 'migrations', '001_create_users_table.sql'), 'utf-8'),
      fs.readFileSync(path.join(__dirname, 'migrations', '002_create_game_state_table.sql'), 'utf-8'),
      fs.readFileSync(path.join(__dirname, 'migrations', '003_create_cube_state_table.sql'), 'utf-8')
    ];

    const clientDB = await pool.connect();
    try {
      for (const migration of migrations) {
        await clientDB.query(migration);
      }
      console.log('Migrations ran successfully.');

      const checkRow = await clientDB.query('SELECT COUNT(*) FROM cube_state WHERE id=1');
      if (checkRow.rows[0].count === '0') {
        const initialLayers = [createLayer(), createLayer()];
        await clientDB.query(
          'INSERT INTO cube_state (id, layers, current_layer) VALUES ($1, $2, $3)',
          [1, JSON.stringify(initialLayers), 1]
        );
        console.log('Created initial cube state');
      } else {
        const { rows } = await clientDB.query('SELECT layers FROM cube_state WHERE id=1');
        let layers;
        try {
          layers = typeof rows[0].layers === 'string'
            ? JSON.parse(rows[0].layers)
            : rows[0].layers;
        } catch (e) {
          layers = null;
        }
        if (!layers || !isCubeStateValid(layers)) {
          const initialLayers = [createLayer(), createLayer()];
          await clientDB.query(
            'UPDATE cube_state SET layers=$1 WHERE id=1',
            [JSON.stringify(initialLayers)]
          );
          console.log('Reset invalid cube state');
        }
      }
    } finally {
      clientDB.release();
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

async function getCubeState() {
  console.log('Getting cube state from database...');
  const { rows } = await pool.query(
    'SELECT layers, current_layer FROM cube_state WHERE id=1'
  );
  let layersData = rows[0].layers;
  let cubeLayers;
  try {
    if (typeof layersData === 'string') {
      cubeLayers = JSON.parse(layersData);
    } else {
      cubeLayers = layersData;
    }
    console.log('Retrieved cube layers:', {
      hasLayers: !!cubeLayers,
      layerCount: cubeLayers?.length
    });
  } catch (e) {
    console.error('Error parsing cube layers:', e);
    cubeLayers = null;
  }

  if (!isCubeStateValid(cubeLayers)) {
    console.log('Creating new cube layers due to invalid state');
    cubeLayers = [createLayer(), createLayer()];
    await updateCubeState(cubeLayers, rows[0].current_layer);
  }
  return {
    layers: cubeLayers,
    currentLayer: rows[0].current_layer
  };
}

async function updateCubeState(layers, currentLayer) {
  await pool.query(
    'UPDATE cube_state SET layers=$1, current_layer=$2 WHERE id=1',
    [JSON.stringify(layers), currentLayer]
  );
}

// Server setup
const app = express();

// Configure CORS based on environment
const isDevelopment = process.env.NODE_ENV === 'development';
const corsOptions = {
  origin: isDevelopment 
    ? 'http://localhost:3000' 
    : 'https://www.minecraftoffline.net',
  methods: ['GET', 'POST'],
  credentials: true
};

console.log('CORS configuration:', corsOptions);
app.use(cors(corsOptions));

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions
});

// Socket middleware
io.use(async (socket, next) => {
  console.log('Socket authentication attempt');
  const token = socket.handshake.auth?.token;
  if (!token) {
    console.error('No token provided');
    return next(new Error('Authentication token missing'));
  }

  try {
    const decoded = await verifyToken(token);
    socket.userId = decoded.sub;
    socket.userData = await getUserData(socket.userId);
    console.log('Socket authenticated for user:', socket.userId);

    // ADDED LINES HERE:
    // If there's no username in the DB for this user, set it from Keycloak token fields
    const keycloakUsername =
      decoded.preferred_username ||
      decoded.username ||
      decoded.name ||
      'Anonymous';

    if (!socket.userData.username || socket.userData.username.trim() === '') {
      await pool.query(
        'UPDATE users SET username = $1 WHERE id = $2',
        [keycloakUsername, socket.userId]
      );
      socket.userData.username = keycloakUsername;
    }
    // END OF ADDED LINES

    next();
  } catch (err) {
    console.error('Socket authentication failed:', err);
    next(new Error('Invalid authentication token'));
  }
});

// Socket events
io.on('connection', async (socket) => {
  console.log(`User connected: ${socket.userId}`);

  try {
    const { layers, currentLayer } = await getCubeState();
    console.log('Retrieved cube state for new connection:', {
      hasLayers: !!layers,
      layerCount: layers?.length,
      currentLayer
    });

    socket.emit('cubeStateUpdate', layers);
    console.log('Emitted cube state update');

    socket.emit('userData', {
      points: socket.userData.points,
      ownedUpgrades: socket.userData.owned_upgrades
    });
    console.log('Emitted user data');

    socket.emit('currentLayer', currentLayer);
    console.log('Emitted current layer');
  } catch (error) {
    console.error('Error handling socket connection:', error);
  }

  socket.on('removeBlock', async ({ face, row, col }) => {
    const { layers: currentLayers, currentLayer: currentLayerNum } = await getCubeState();
    if (currentLayers[0][face][row][col]) {
      currentLayers[0][face][row][col] = false;

      if (isLayerComplete(currentLayers[0])) {
        const newLayers = [currentLayers[1], createLayer()];
        const newLayer = currentLayerNum + 1;
        await updateCubeState(newLayers, newLayer);
        io.emit('currentLayer', newLayer);
        io.emit('cubeStateUpdate', newLayers);
      } else {
        await updateCubeState(currentLayers, currentLayerNum);
        io.emit('cubeStateUpdate', currentLayers);
      }
    }
  });

  socket.on('nukeLayer', async () => {
    if (socket.userData.owned_upgrades.includes('nuker')) {
      const { layers: currentLayers, currentLayer: currentLayerNum } = await getCubeState();

      let blockCount = 0;
      Object.keys(currentLayers[0]).forEach(face => {
        if (Array.isArray(currentLayers[0][face])) {
          currentLayers[0][face].forEach(row => {
            row.forEach(block => {
              if (block) blockCount++;
            });
          });
        }
      });

      let pointsEarned = blockCount;
      if (socket.userData.owned_upgrades.includes('double')) pointsEarned *= 2;
      if (socket.userData.owned_upgrades.includes('doublePro')) pointsEarned *= 2;
      if (socket.userData.owned_upgrades.includes('doubleMax')) pointsEarned *= 2;

      socket.userData.points += pointsEarned;
      await updateUserData(socket.userId, socket.userData);

      // Remove all blocks on the current layer
      Object.keys(currentLayers[0]).forEach(face => {
        if (Array.isArray(currentLayers[0][face])) {
          currentLayers[0][face] = currentLayers[0][face].map(row =>
            row.map(() => false)
          );
        }
      });

      // Move on to next layer
      const newLayers = [currentLayers[1], createLayer()];
      const newLayer = currentLayerNum + 1;

      await updateCubeState(newLayers, newLayer);

      io.emit('cubeStateUpdate', newLayers);
      io.emit('currentLayer', newLayer);
      socket.emit('userData', {
        points: socket.userData.points,
        ownedUpgrades: socket.userData.owned_upgrades
      });

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
        doublePro: 3000,
        doubleMax: 30000,
        autoClicker: 100,
        autoClickerFast: 5000,
        autoClickerUltra: 50000,
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
