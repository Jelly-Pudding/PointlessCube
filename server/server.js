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
  KEYCLOAK_ISSUER,
  PGHOST,
  PGUSER,
  PGPASSWORD,
  PGDATABASE,
  PGPORT,
} = process.env;

// Initialize JWKS client for token verification
const client = jwksClient({
  jwksUri: `${KEYCLOAK_ISSUER}/protocol/openid-connect/certs`,
});

// Function to retrieve signing key
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
          KEYCLOAK_ISSUER,  // http://keycloak:8080/realms/myrealm
          KEYCLOAK_ISSUER.replace('keycloak', 'localhost') // http://localhost:8080/realms/myrealm
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

// Initialize PostgreSQL pool
const pool = new Pool({
  host: PGHOST,
  user: PGUSER,
  password: PGPASSWORD,
  database: PGDATABASE,
  port: PGPORT,
});

// Run migrations to ensure the users table exists
(async () => {
  const migration = fs.readFileSync(
    path.join(__dirname, 'migrations', '001_create_users_table.sql'),
    'utf-8'
  );
  const client = await pool.connect();
  try {
    await client.query(migration);
    console.log('Migration ran successfully.');
  } catch (err) {
    console.error('Error running migration:', err);
    process.exit(1);
  } finally {
    client.release();
  }
})().catch((err) => {
  console.error('Unexpected error during migration:', err);
  process.exit(1);
});

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Update this in production to your frontend's domain
    methods: ['GET', 'POST'],
  },
});

// Cube logic (unchanged)
const GRID_SIZE = 50;

function createFace() {
  return Array(GRID_SIZE)
    .fill()
    .map(() => new Array(GRID_SIZE).fill(true));
}

function generateColor() {
  const hue = Math.floor(Math.random() * 360);
  const saturation = Math.floor(Math.random() * 30 + 60);
  const lightness = Math.floor(Math.random() * 20 + 45);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

const COLOR_POOL_SIZE = 10;
const usedColors = new Set();

function getNextColor() {
  let newColor;
  do {
    newColor = generateColor();
  } while (usedColors.has(newColor));

  usedColors.add(newColor);
  if (usedColors.size > COLOR_POOL_SIZE) {
    const firstColor = usedColors.values().next().value;
    usedColors.delete(firstColor);
  }
  return newColor;
}

function createLayer(color) {
  return {
    front: createFace(),
    back: createFace(),
    top: createFace(),
    bottom: createFace(),
    left: createFace(),
    right: createFace(),
    color: color,
  };
}

function isLayerComplete(layer) {
  const faceNames = [
    'front',
    'back',
    'top',
    'bottom',
    'left',
    'right',
  ];
  return faceNames.every((faceName) =>
    layer[faceName].every((row) => row.every((block) => !block))
  );
}

// Initial cube state
let layers = [createLayer(getNextColor()), createLayer(getNextColor())];

function removeBlock(face, row, col) {
  if (layers[0][face][row][col]) {
    layers[0][face][row][col] = false;
    if (isLayerComplete(layers[0])) {
      const [_, bottomLayer] = layers;
      layers = [bottomLayer, createLayer(getNextColor())];
    }
  }
}

// Function to get user data from the database
async function getUserData(userId) {
  const { rows } = await pool.query(
    'SELECT id, points, owned_upgrades FROM users WHERE id=$1',
    [userId]
  );
  if (rows.length > 0) return rows[0];

  // If user doesn't exist, create a new record
  await pool.query('INSERT INTO users (id) VALUES ($1)', [userId]);
  return { id: userId, points: 0, owned_upgrades: [] };
}

// Function to update user data in the database
async function updateUserData(userId, data) {
  await pool.query(
    'UPDATE users SET points=$1, owned_upgrades=$2 WHERE id=$3',
    [data.points, data.owned_upgrades, userId]
  );
}

// Middleware to validate JWT tokens and load user data
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication token missing'));

  try {
    console.log('Token payload:', jwt.decode(token));
    const decoded = await verifyToken(token);
    socket.userId = decoded.sub; // Unique user ID from Keycloak
    socket.userData = await getUserData(socket.userId);
    next();
  } catch (err) {
    console.error('Token verification failed:', err);
    next(new Error('Invalid authentication token'));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId}`);

  // Send current cube state
  socket.emit('cubeStateUpdate', layers);

  // Send user-specific data
  socket.emit('userData', {
    points: socket.userData.points,
    ownedUpgrades: socket.userData.owned_upgrades,
  });

  // Handle block removal
  socket.on('removeBlock', async ({ face, row, col }) => {
    removeBlock(face, row, col);
    io.emit('cubeStateUpdate', layers);
  });

  // Handle points update
  socket.on('updatePoints', async ({ points }) => {
    socket.userData.points += points;
    await updateUserData(socket.userId, socket.userData);
    socket.emit('userData', {
      points: socket.userData.points,
      ownedUpgrades: socket.userData.owned_upgrades,
    });
  });

  // Handle upgrade purchase
  socket.on('purchaseUpgrade', async ({ upgrade }) => {
    const user = socket.userData;
    let cost = 0;
    if (upgrade === 'double') cost = 50;
    if (upgrade === 'autoClicker') cost = 100;

    if (
      user.points >= cost &&
      !user.owned_upgrades.includes(upgrade)
    ) {
      user.points -= cost;
      user.owned_upgrades.push(upgrade);
      await updateUserData(socket.userId, user);
      socket.emit('userData', {
        points: user.points,
        ownedUpgrades: user.owned_upgrades,
      });
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