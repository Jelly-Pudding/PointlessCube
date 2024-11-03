import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo, useCallback } from 'react';
import './Cube.css';

const CUBE_SIZE = 600;
const GRID_SIZE = 2;

// Random color generation
const generateColor = () => {
  const hue = Math.floor(Math.random() * 360);
  const saturation = Math.floor(Math.random() * 30 + 60);
  const lightness = Math.floor(Math.random() * 20 + 45);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

const COLOR_POOL_SIZE = 10;
const usedColors = new Set();

const getNextColor = () => {
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
};

// Audio context moved outside component
const audioContext = new AudioContext();
const createBreakSound = () => ({
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
});

const createFace = () =>
  Array(GRID_SIZE).fill().map(() => new Array(GRID_SIZE).fill(true));

const createLayer = (color) => ({
  front: createFace(),
  back: createFace(),
  top: createFace(),
  bottom: createFace(),
  left: createFace(),
  right: createFace(),
  color: color,
});

const isLayerComplete = (layer) => {
  const faceNames = ['front', 'back', 'top', 'bottom', 'left', 'right'];
  return faceNames.every((faceName) =>
    layer[faceName].every((row) => row.every((block) => !block))
  );
};

// Optimized Face component with React.memo
const Face = React.memo(({ layers, faceName, handleClick, transform, gridSize }) => {
  const blocks = useMemo(() => {
    const visibleBlocks = [];
    
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        let blockVisible = false;
        let blockColor = 'transparent';
        let isTopLayer = false;

        // Only check top two layers
        for (let layerIndex = 0; layerIndex < 2; layerIndex++) {
          const layer = layers[layerIndex];
          if (layer[faceName][i][j]) {
            blockVisible = true;
            blockColor = layer.color;
            isTopLayer = layerIndex === 0;
            break;
          }
        }

        if (blockVisible) {
          visibleBlocks.push(
            <button
              key={`${i}-${j}`}
              onClick={(e) => {
                e.stopPropagation();
                if (isTopLayer) {
                  handleClick(faceName, i, j);
                }
              }}
              className="grid-block"
              style={{
                backgroundColor: blockColor,
                gridRow: i + 1,
                gridColumn: j + 1,
                cursor: isTopLayer ? 'pointer' : 'default'
              }}
            />
          );
        }
      }
    }
    return visibleBlocks;
  }, [layers, faceName, handleClick, gridSize]);

  return (
    <div className="face" style={{ transform }}>
      <div className="grid-container" style={{ '--grid-size': gridSize }}>
        {blocks}
      </div>
    </div>
  );
}, (prevProps, nextProps) => prevProps.layers[0] === nextProps.layers[0]);

const Cube = forwardRef(({ onBlockClick }, ref) => {
  const [theta, setTheta] = useState(45);
  const [phi, setPhi] = useState(-30);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartTime, setDragStartTime] = useState(null);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1500);
  const [breakSound] = useState(createBreakSound);
  const rotationSensitivity = 0.2;
  const DRAG_THRESHOLD = 5;  // pixels of movement needed to start drag
  const DRAG_DELAY = 150;    // milliseconds to hold before drag starts

  // Initialize with random colors
  const [layers, setLayers] = useState([
    createLayer(getNextColor()),
    createLayer(getNextColor()),
  ]);

  useEffect(() => {
    const currentLayer = layers[0];
    if (isLayerComplete(currentLayer)) {
      requestAnimationFrame(() => {
        setLayers(prevLayers => {
          const [_, bottomLayer] = prevLayers;
          return [bottomLayer, createLayer(getNextColor())];
        });
      });
    }
  }, [layers]);

  const handleClick = useCallback((face, row, col) => {
    setLayers(prevLayers => {
      // Skip if block is already broken
      if (!prevLayers[0][face][row][col]) return prevLayers;
      
      const newLayers = [...prevLayers];
      const currentLayer = { ...newLayers[0] };
      const newFace = [...currentLayer[face]];
      newFace[row] = [...newFace[row]];
      newFace[row][col] = false;
      currentLayer[face] = newFace;
      newLayers[0] = currentLayer;

      // Play sound immediately
      breakSound?.play();
      onBlockClick?.();

      return newLayers;
    });
  }, [breakSound, onBlockClick]);

  const removeRandomBlock = useCallback(() => {
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
  }, [layers, handleClick]);

  useImperativeHandle(ref, () => ({
    removeRandomBlock
  }), [removeRandomBlock]);

  const handleMouseDown = useCallback((e) => {
    setDragStartTime(Date.now());
    setLastPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!dragStartTime) return;

    // Check if enough time has passed
    if (Date.now() - dragStartTime < DRAG_DELAY) return;

    // Check if moved enough pixels
    const deltaX = Math.abs(e.clientX - lastPos.x);
    const deltaY = Math.abs(e.clientY - lastPos.y);
    
    if (!isDragging && (deltaX < DRAG_THRESHOLD && deltaY < DRAG_THRESHOLD)) return;

    if (!isDragging) {
      setIsDragging(true);
    }

    requestAnimationFrame(() => {
      setTheta(prevTheta => prevTheta + (e.clientX - lastPos.x) * rotationSensitivity);
      setPhi(prevPhi => {
        const newPhi = prevPhi - (e.clientY - lastPos.y) * rotationSensitivity;
        return Math.max(-90, Math.min(90, newPhi));
      });
    });

    setLastPos({ x: e.clientX, y: e.clientY });
  }, [isDragging, lastPos, rotationSensitivity, dragStartTime]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStartTime(null);
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    requestAnimationFrame(() => {
      setZoom(prevZoom => {
        const zoomFactor = Math.exp(e.deltaY * 0.001);
        return Math.min(Math.max(prevZoom * zoomFactor, 800), 3000);
      });
    });
  }, []);

  const cubeTransform = useMemo(() => `
    translate(-50%, -50%)
    rotateX(${phi}deg)
    rotateY(${theta}deg)
  `, [phi, theta]);

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