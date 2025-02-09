// client/src/CanvasFace.jsx
import React, { useEffect, useRef, useCallback } from 'react';

const CanvasFace = ({
  layers,
  faceName,
  handleClick,
  transform,
  gridSize,
  width,
  height,
}) => {
  const canvasRef = useRef(null);

  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const blockWidth = canvas.width / gridSize;
    const blockHeight = canvas.height / gridSize;

    // Loop through grid and draw blocks based on layers data
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        let blockVisible = false;
        let blockColor = 'transparent';
        for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
          const layer = layers[layerIndex];
          if (layer[faceName] && layer[faceName][i] && layer[faceName][i][j]) {
            blockVisible = true;
            blockColor = layer.color;
            break;
          }
        }
        if (blockVisible) {
          ctx.fillStyle = blockColor;
          ctx.fillRect(j * blockWidth, i * blockHeight, blockWidth, blockHeight);
        }
        // Draw a subtle border for each block
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.strokeRect(j * blockWidth, i * blockHeight, blockWidth, blockHeight);
      }
    }
  }, [layers, faceName, gridSize]);

  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  const handlePointerDown = (e) => {
    // Prevent event propagation so parent handlers (rotation/drag) aren’t triggered
    e.stopPropagation();

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const blockWidth = rect.width / gridSize;
    const blockHeight = rect.height / gridSize;
    const col = Math.floor(x / blockWidth);
    const row = Math.floor(y / blockHeight);

    handleClick(faceName, row, col);
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        transform: transform,
        position: 'absolute',
        cursor: 'pointer',
      }}
      onPointerDown={handlePointerDown}
    />
  );
};

export default CanvasFace;
