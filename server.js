// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// Keycloak configuration
const keycloakUrl = 'http://localhost:8080';
const realm = 'myrealm';
const issuer = `${keycloakUrl}/realms/${realm}`;

const client = jwksClient({
  jwksUri: `${issuer}/protocol/openid-connect/certs`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, function (err, key) {
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      issuer: issuer,
      algorithms: ['RS256']
    }, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

// User data store: In production use a real DB
let userData = {}; // userData[userId] = { points: number, ownedUpgrades: [] }

// Cube logic
const GRID_SIZE = 50;
const CUBE_SIZE = 600;

function createFace() {
  return Array(GRID_SIZE).fill().map(() => new Array(GRID_SIZE).fill(true));
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
    const [firstColor] = usedColors;
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
  const faceNames = ['front', 'back', 'top', 'bottom', 'left', 'right'];
  return faceNames.every((faceName) =>
    layer[faceName].every((row) => row.every((block) => !block))
  );
}

// Initial cube state
let layers = [
  createLayer(getNextColor()),
  createLayer(getNextColor()),
];

function removeBlock(face, row, col) {
  if (layers[0][face][row][col]) {
    layers[0][face][row][col] = false;
    if (isLayerComplete(layers[0])) {
      const [_, bottomLayer] = layers;
      layers = [bottomLayer, createLayer(getNextColor())];
    }
  }
}

// Socket middleware to validate token
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token provided'));

  try {
    const decoded = await verifyToken(token);
    socket.userId = decoded.sub; // Unique user ID from Keycloak token
    // Initialize user data if not present
    if (!userData[socket.userId]) {
      userData[socket.userId] = { points: 0, ownedUpgrades: [] };
    }
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  // Send current cube state
  socket.emit('cubeStateUpdate', layers);
  // Send user data
  socket.emit('userData', userData[socket.userId]);

  socket.on('removeBlock', ({ face, row, col }) => {
    removeBlock(face, row, col);
    io.emit('cubeStateUpdate', layers);
  });

  socket.on('updatePoints', ({ points }) => {
    userData[socket.userId].points += points;
    socket.emit('userData', userData[socket.userId]);
  });

  socket.on('purchaseUpgrade', ({ upgrade }) => {
    const user = userData[socket.userId];
    let cost = 0;
    if (upgrade === 'double') cost = 50;
    if (upgrade === 'autoClicker') cost = 100;

    if (user.points >= cost && !user.ownedUpgrades.includes(upgrade)) {
      user.points -= cost;
      user.ownedUpgrades.push(upgrade);
      socket.emit('userData', user);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
