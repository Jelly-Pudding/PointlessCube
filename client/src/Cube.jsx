// src/Cube.jsx
import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo, useCallback } from 'react';
import './Cube.css';

const CUBE_SIZE = 600;
const GRID_SIZE = 4;

const audioContext = new AudioContext();
const gainNode = audioContext.createGain();
gainNode.connect(audioContext.destination);

const playBreakSound = () => {
  const oscillator = audioContext.createOscillator();
  oscillator.connect(gainNode);
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  oscillator.start(audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
  oscillator.stop(audioContext.currentTime + 0.1);
};

const Face = React.memo(({ layers, faceName, handleClick, transform, gridSize }) => {
  const blocks = useMemo(() => {
    const visibleBlocks = [];
    
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        // Check top layer first
        if (layers[0][faceName][i][j]) {
          visibleBlocks.push(
            <button
              key={`${i}-${j}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                handleClick(faceName, i, j);
              }}
              className="grid-block"
              style={{
                backgroundColor: layers[0].color,
                gridRow: i + 1,
                gridColumn: j + 1,
                cursor: 'pointer',
                touchAction: 'none'
              }}
            />
          );
        }
        // Only show bottom layer block if there's no top block
        else if (layers[1][faceName][i][j]) {
          visibleBlocks.push(
            <button
              key={`${i}-${j}`}
              className="grid-block"
              style={{
                backgroundColor: layers[1].color,
                gridRow: i + 1,
                gridColumn: j + 1,
                cursor: 'default',
                touchAction: 'none',
                opacity: 0.8
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
});

const Cube = forwardRef(({ onBlockClick, layers, socket }, ref) => {
  const [theta, setTheta] = useState(45);
  const [phi, setPhi] = useState(-30);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartTime, setDragStartTime] = useState(null);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1500);

  const rotationSensitivity = 0.2;
  const DRAG_THRESHOLD = 5;
  const DRAG_DELAY = 150;

  const handleBlockRemove = useCallback((face, row, col) => {
    if (layers[0][face][row][col]) {
      playBreakSound();
      onBlockClick?.();
      socket.emit('removeBlock', { face, row, col });
    }
  }, [layers, socket, onBlockClick]);

  const handleMouseDown = useCallback((e) => {
    setDragStartTime(Date.now());
    setLastPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!dragStartTime) return;
    if (Date.now() - dragStartTime < DRAG_DELAY) return;

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

  useImperativeHandle(ref, () => ({
    requestRandomBlockRemoval() {
      if (!layers) return;
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
        handleBlockRemove(face, row, col);
      }
    }
  }), [layers, handleBlockRemove]);

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
            transform: `translate(-50%, -50%) rotateX(${phi}deg) rotateY(${theta}deg)`,
          }}
        >
          <Face
            layers={layers}
            faceName="front"
            handleClick={handleBlockRemove}
            transform={`translateZ(${CUBE_SIZE / 2}px)`}
            gridSize={GRID_SIZE}
          />
          <Face
            layers={layers}
            faceName="back"
            handleClick={handleBlockRemove}
            transform={`translateZ(${-CUBE_SIZE / 2}px) rotateY(180deg)`}
            gridSize={GRID_SIZE}
          />
          <Face
            layers={layers}
            faceName="top"
            handleClick={handleBlockRemove}
            transform={`translateY(${-CUBE_SIZE / 2}px) rotateX(90deg)`}
            gridSize={GRID_SIZE}
          />
          <Face
            layers={layers}
            faceName="bottom"
            handleClick={handleBlockRemove}
            transform={`translateY(${CUBE_SIZE / 2}px) rotateX(-90deg)`}
            gridSize={GRID_SIZE}
          />
          <Face
            layers={layers}
            faceName="left"
            handleClick={handleBlockRemove}
            transform={`translateX(${-CUBE_SIZE / 2}px) rotateY(-90deg)`}
            gridSize={GRID_SIZE}
          />
          <Face
            layers={layers}
            faceName="right"
            handleClick={handleBlockRemove}
            transform={`translateX(${CUBE_SIZE / 2}px) rotateY(90deg)`}
            gridSize={GRID_SIZE}
          />
        </div>
      </div>
    </div>
  );
});

export default Cube;
