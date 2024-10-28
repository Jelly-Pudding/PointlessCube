import React, { useState, useEffect } from 'react';
import './Cube.css'; // Import CSS for styling

const CUBE_SIZE = 300;

// Define colors for each layer
const LAYER_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];

// Helper function to create a face with all blocks visible
const createFace = () => Array(3).fill().map(() => Array(3).fill(true));

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

// **Corrected Function** to check if a layer is completely removed
const isLayerComplete = (layer) => {
  const faceNames = ['front', 'back', 'top', 'bottom', 'left', 'right'];
  return faceNames.every(faceName =>
    layer[faceName].every(row => row.every(block => !block))
  );
};

// Face component responsible for rendering a single face of the cube
const Face = ({ layers, faceName, handleClick, transform }) => (
  <div
    className="face"
    style={{ transform }}
  >
    <div className="grid-container">
      {Array(3).fill().map((_, i) =>
        Array(3).fill().map((_, j) => {
          // Find the topmost visible block at this position
          let blockVisible = false;
          let blockColor = 'transparent';
          let isTopLayer = false;
          for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
            const layer = layers[layerIndex];
            if (layer[faceName][i][j]) {
              blockVisible = true;
              blockColor = layer.color; // Use the layer's color
              isTopLayer = layerIndex === 0;
              break;
            }
          }
          return (
            <button
              key={`${i}-${j}`}
              onClick={() => {
                // Only allow interaction if the block is on the top layer
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

const Cube = () => {
  const [rotateX, setRotateX] = useState(30);
  const [rotateY, setRotateY] = useState(45);
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  // Initialize with multiple layers and assign colors
  const [layers, setLayers] = useState([
    createLayer(LAYER_COLORS[0]),
    createLayer(LAYER_COLORS[1]),
    createLayer(LAYER_COLORS[2]),
  ]);

  // Keep track of the next color index
  const [nextColorIndex, setNextColorIndex] = useState(layers.length);

  // Check if the current top layer is complete
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
  };

  // Handle mouse events for rotation
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - lastPos.x;
    const deltaY = e.clientY - lastPos.y;
    setRotateY(prev => prev + deltaX * 0.5);
    setRotateX(prev => prev - deltaY * 0.5); // Subtract deltaY to fix inversion
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="cube-container">
      <div 
        className="cube-wrapper"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="cube"
          style={{
            width: CUBE_SIZE,
            height: CUBE_SIZE,
            transform: `translate(-50%, -50%) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          }}
        >
          <Face
            layers={layers}
            faceName="front"
            handleClick={handleClick}
            transform={`translateZ(${CUBE_SIZE / 2}px)`}
          />
          <Face
            layers={layers}
            faceName="back"
            handleClick={handleClick}
            transform={`translateZ(${-CUBE_SIZE / 2}px) rotateY(180deg)`}
          />
          <Face
            layers={layers}
            faceName="top"
            handleClick={handleClick}
            transform={`translateY(${-CUBE_SIZE / 2}px) rotateX(90deg)`}
          />
          <Face
            layers={layers}
            faceName="bottom"
            handleClick={handleClick}
            transform={`translateY(${CUBE_SIZE / 2}px) rotateX(-90deg)`}
          />
          <Face
            layers={layers}
            faceName="left"
            handleClick={handleClick}
            transform={`translateX(${-CUBE_SIZE / 2}px) rotateY(-90deg)`}
          />
          <Face
            layers={layers}
            faceName="right"
            handleClick={handleClick}
            transform={`translateX(${CUBE_SIZE / 2}px) rotateY(90deg)`}
          />
        </div>
      </div>
    </div>
  );
};

export default Cube;
