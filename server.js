// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // In production, specify your domain here
  }
});

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

// Initial cube state: top layer + one underneath
let layers = [
  createLayer(getNextColor()),
  createLayer(getNextColor()),
];

function removeBlock(face, row, col) {
  if (layers[0][face][row][col]) {
    layers[0][face][row][col] = false;

    // Check if top layer is complete
    if (isLayerComplete(layers[0])) {
      const [_, bottomLayer] = layers;
      layers = [bottomLayer, createLayer(getNextColor())];
    }
  }
}

// Socket.io event handling
io.on('connection', (socket) => {
  // Send current cube state to the newly connected client
  socket.emit('cubeStateUpdate', layers);

  // When a client requests to remove a block
  socket.on('removeBlock', ({ face, row, col }) => {
    removeBlock(face, row, col);
    // Broadcast updated cube state to all clients
    io.emit('cubeStateUpdate', layers);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
