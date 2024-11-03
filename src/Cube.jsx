import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import './Cube.css';

const CUBE_SIZE = 600;
const GRID_SIZE = 10;

// Define colors for each layer
const LAYER_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];

// Create audio context and sound effect
const createBreakSound = () => {
  const audioContext = new AudioContext();
  
  return {
    play: () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      
      oscillator.start(audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      oscillator.stop(audioContext.currentTime + 0.1);
    }
  };
};

// Helper function to create a face with all blocks visible
const createFace = () =>
  Array(GRID_SIZE)
    .fill()
    .map(() => Array(GRID_SIZE).fill(true));

// Helper function to create a new layer with a specific color
const createLayer = (color) => ({
  front: createFace(),
  back: createFace(),
  top: createFace(),
  bottom: createFace(),
  left: createFace(),
  right: createFace(),
  color: color,
});

// Function to check if a layer is completely removed
const isLayerComplete = (layer) => {
  const faceNames = ['front', 'back', 'top', 'bottom', 'left', 'right'];
  return faceNames.every((faceName) =>
    layer[faceName].every((row) => row.every((block) => !block))
  );
};

// Face component responsible for rendering a single face of the cube
const Face = ({ layers, faceName, handleClick, transform, gridSize }) => (
  <div className="face" style={{ transform }}>
    <div className="grid-container" style={{ '--grid-size': gridSize }}>
      {Array(gridSize)
        .fill()
        .map((_, i) =>
          Array(gridSize)
            .fill()
            .map((_, j) => {
              let blockVisible = false;
              let blockColor = 'transparent';
              let isTopLayer = false;
              for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
                const layer = layers[layerIndex];
                if (layer[faceName][i][j]) {
                  blockVisible = true;
                  blockColor = layer.color;
                  isTopLayer = layerIndex === 0;
                  break;
                }
              }
              return (
                <button
                  key={`${i}-${j}`}
                  onClick={() => {
                    if (isTopLayer && blockVisible) {
                      handleClick(faceName, i, j);
                    }
                  }}
                  className="grid-block"
                  style={{
                    backgroundColor: blockVisible ? blockColor : 'transparent',
                    cursor: isTopLayer && blockVisible ? 'pointer' : 'default',
                  }}
                />
              );
            })
        )}
    </div>
  </div>
);

// Modify the component to accept a ref
const Cube = forwardRef(({ onBlockClick }, ref) => {
  const [theta, setTheta] = useState(45);
  const [phi, setPhi] = useState(-30);
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1500);
  const [breakSound, setBreakSound] = useState(null);

  const rotationSensitivity = 0.2;

  // Initialize sound effect
  useEffect(() => {
    setBreakSound(createBreakSound());
  }, []);

  // Initialize with multiple layers and assign colors
  const [layers, setLayers] = useState([
    createLayer(LAYER_COLORS[0]),
    createLayer(LAYER_COLORS[1]),
    createLayer(LAYER_COLORS[2]),
  ]);

  const [nextColorIndex, setNextColorIndex] = useState(layers.length);

  useEffect(() => {
    const currentLayer = layers[0];
    if (isLayerComplete(currentLayer)) {
      setLayers((prevLayers) => {
        const newLayers = prevLayers.slice(1);
        const newColor = LAYER_COLORS[nextColorIndex % LAYER_COLORS.length];
        newLayers.push(createLayer(newColor));
        return newLayers;
      });
      setNextColorIndex((prevIndex) => prevIndex + 1);
    }
  }, [layers, nextColorIndex]);

  // Handle block click
  const handleClick = (face, row, col) => {
    setLayers((prevLayers) => {
      const newLayers = [...prevLayers];
      const currentLayer = { ...newLayers[0] };
      currentLayer[face] = currentLayer[face].map((r, i) =>
        i === row ? r.map((block, j) => (j === col ? false : block)) : r
      );
      newLayers[0] = currentLayer;
      return newLayers;
    });

    // Play break sound
    if (breakSound) {
      try {
        breakSound.play();
      } catch (error) {
        console.log('Error playing sound:', error);
      }
    }

    if (onBlockClick) {
      onBlockClick();
    }
  };

  const removeRandomBlock = () => {
    const faceNames = ['front', 'back', 'top', 'bottom', 'left', 'right'];
    const visibleBlocks = [];

    faceNames.forEach((face) => {
      layers[0][face].forEach((row, rowIndex) => {
        row.forEach((block, colIndex) => {
          if (block) {
            visibleBlocks.push({ face, row: rowIndex, col: colIndex });
          }
        });
      });
    });

    if (visibleBlocks.length > 0) {
      const randomIndex = Math.floor(Math.random() * visibleBlocks.length);
      const { face, row, col } = visibleBlocks[randomIndex];
      handleClick(face, row, col);
    }
  };

  useImperativeHandle(ref, () => ({
    removeRandomBlock,
  }));

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - lastPos.x;
    const deltaY = e.clientY - lastPos.y;

    setTheta((prevTheta) => prevTheta + deltaX * rotationSensitivity);
    setPhi((prevPhi) => {
      const newPhi = prevPhi - deltaY * rotationSensitivity;
      return Math.max(-90, Math.min(90, newPhi));
    });

    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    setZoom((prevZoom) => {
      const zoomFactor = Math.exp(e.deltaY * 0.001);
      let newZoom = prevZoom * zoomFactor;
      newZoom = Math.min(Math.max(newZoom, 500), 5000);
      return newZoom;
    });
  };

  const cubeTransform = `
    translate(-50%, -50%)
    rotateX(${phi}deg)
    rotateY(${theta}deg)
  `;

  return (
    <div
      className="cube-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <div
        className="cube-wrapper"
        style={{
          perspective: `${zoom}px`,
          transition: 'perspective 0.1s ease-out',
        }}
      >
        <div
          className="cube"
          style={{
            width: CUBE_SIZE,
            height: CUBE_SIZE,
            transform: cubeTransform,
          }}
        >
          <Face
            layers={layers}
            faceName="front"
            handleClick={handleClick}
            transform={`translateZ(${CUBE_SIZE / 2}px)`}
            gridSize={GRID_SIZE}
          />
          <Face
            layers={layers}
            faceName="back"
            handleClick={handleClick}
            transform={`translateZ(${-CUBE_SIZE / 2}px) rotateY(180deg)`}
            gridSize={GRID_SIZE}
          />
          <Face
            layers={layers}
            faceName="top"
            handleClick={handleClick}
            transform={`translateY(${-CUBE_SIZE / 2}px) rotateX(90deg)`}
            gridSize={GRID_SIZE}
          />
          <Face
            layers={layers}
            faceName="bottom"
            handleClick={handleClick}
            transform={`translateY(${CUBE_SIZE / 2}px) rotateX(-90deg)`}
            gridSize={GRID_SIZE}
          />
          <Face
            layers={layers}
            faceName="left"
            handleClick={handleClick}
            transform={`translateX(${-CUBE_SIZE / 2}px) rotateY(-90deg)`}
            gridSize={GRID_SIZE}
          />
          <Face
            layers={layers}
            faceName="right"
            handleClick={handleClick}
            transform={`translateX(${CUBE_SIZE / 2}px) rotateY(90deg)`}
            gridSize={GRID_SIZE}
          />
        </div>
      </div>
    </div>
  );
});

export default Cube;