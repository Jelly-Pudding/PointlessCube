import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo, useCallback, useRef } from 'react';
import './Cube.css';

const CUBE_SIZE = 600;
const GRID_SIZE = 32;

const createBlockParticles = (e, blockColor, face, position) => {
  const rect = e.target.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const particleCount = Math.floor(Math.random() * 3) + 2; // Random between 2 and 4
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'block-particle';
    particle.style.backgroundColor = blockColor;
    document.body.appendChild(particle);

    // Slightly larger particles
    const size = Math.random() * 10 + 6;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;

    let px = centerX + (Math.random() - 0.5) * 5;
    let py = centerY + (Math.random() - 0.5) * 5;

    particle.style.left = `${px}px`;
    particle.style.top = `${py}px`;

    // Slow, random initial direction
    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 0.3 + 0.2;
    let vx = Math.cos(angle) * velocity;
    let vy = Math.sin(angle) * velocity;

    let frame = 0;
    const maxFrames = 180; // About 3 seconds at 60 fps
    const gravity = -0.005; // A small negative value for a gentle upward drift

    const animate = () => {
      frame++;
      vy += gravity;
      px += vx;
      py += vy;

      const sizeRatio = 1 - frame / maxFrames;
      particle.style.width = `${size * sizeRatio}px`;
      particle.style.height = `${size * sizeRatio}px`;
      particle.style.left = `${px}px`;
      particle.style.top = `${py}px`;

      // Fade out gradually, starting halfway through the lifespan
      if (frame > maxFrames * 0.5) {
        const fadeRatio = 1 - (frame - maxFrames * 0.5) / (maxFrames * 0.5);
        particle.style.opacity = fadeRatio;
      }

      if (frame < maxFrames) {
        requestAnimationFrame(animate);
      } else {
        particle.remove();
      }
    };
    requestAnimationFrame(animate);
  }
};

const Face = React.memo(({ layers, faceName, handleClick, transform, gridSize }) => {
  const blocks = useMemo(() => {
    const visibleBlocks = [];
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        let blockVisible = false;
        let blockColor = 'transparent';
        let isTopLayer = false;

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
              onPointerDown={(e) => {
                e.stopPropagation();
                if (isTopLayer) {
                  createBlockParticles(e, blockColor, faceName, { row: i, col: j });
                  handleClick(faceName, i, j);
                }
              }}
              className="grid-block"
              style={{
                backgroundColor: blockColor,
                gridRow: i + 1,
                gridColumn: j + 1,
                cursor: isTopLayer ? 'pointer' : 'default',
                touchAction: 'none'
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
}, (prevProps, nextProps) =>
  prevProps.transform === nextProps.transform &&
  prevProps.layers === nextProps.layers
);

const Cube = forwardRef(({ onBlockClick, layers, socket, isMuted }, forwardedRef) => {
  const containerRef = useRef(null);
  const [theta, setTheta] = useState(45);
  const [phi, setPhi] = useState(-30);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartTime, setDragStartTime] = useState(null);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1500);
  const [audioContext, setAudioContext] = useState(null);
  const [lastPlayTime, setLastPlayTime] = useState(0);

  // For touch pinch zoom
  const pointers = useRef({}); // Track active pointers by their id
  const initialPinchDistance = useRef(null);
  const initialZoom = useRef(null);

  const rotationSensitivity = 0.2;
  const DRAG_THRESHOLD = 5;
  const DRAG_DELAY = 150;

  const initAudioContext = useCallback(() => {
    if (!audioContext) {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      setAudioContext({ context: ctx, gainNode: gain });
    }
  }, [audioContext]);

  const playBreakSound = useCallback(() => {
    if (isMuted) return; // Do nothing if muted
    if (!audioContext) {
      initAudioContext();
      return;
    }

    const now = Date.now();
    if (now - lastPlayTime < 30) return;
    setLastPlayTime(now);

    const oscillator = audioContext.context.createOscillator();
    const tempGain = audioContext.context.createGain();

    oscillator.connect(tempGain);
    tempGain.connect(audioContext.context.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(200, audioContext.context.currentTime);
    tempGain.gain.setValueAtTime(0.2, audioContext.context.currentTime);
    oscillator.start(audioContext.context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.context.currentTime + 0.1);
    tempGain.gain.exponentialRampToValueAtTime(0.01, audioContext.context.currentTime + 0.15);
    oscillator.stop(audioContext.context.currentTime + 0.15);

    setTimeout(() => {
      tempGain.disconnect();
      oscillator.disconnect();
    }, 200);
  }, [audioContext, initAudioContext, lastPlayTime, isMuted]);

  const handleBlockRemove = useCallback((face, row, col) => {
    playBreakSound();
    onBlockClick?.();
    socket.emit('removeBlock', { face, row, col });
  }, [socket, onBlockClick, playBreakSound]);

  // Pointer event handlers
  const handlePointerDown = useCallback((e) => {
    // Record pointer position
    pointers.current[e.pointerId] = { x: e.clientX, y: e.clientY };

    // For single-pointer drag, record start time and position
    if (Object.keys(pointers.current).length === 1) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragStartTime(Date.now());
      setLastPos({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handlePointerMove = useCallback((e) => {
    // Update the pointer's current position
    pointers.current[e.pointerId] = { x: e.clientX, y: e.clientY };

    const activePointers = Object.keys(pointers.current);
    if (activePointers.length >= 2) {
      // Pinch-zoom branch
      const [id1, id2] = activePointers;
      const p1 = pointers.current[id1];
      const p2 = pointers.current[id2];
      const currentDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (initialPinchDistance.current === null) {
        initialPinchDistance.current = currentDistance;
        initialZoom.current = zoom;
      } else {
        // Invert the ratio so that spreading fingers zooms in (i.e. decreases zoom)
        let newZoom = initialZoom.current * (initialPinchDistance.current / currentDistance);
        // Clamp the zoom between 800 and 3000
        newZoom = Math.min(Math.max(newZoom, 700), 3000);
        setZoom(newZoom);
      }
      // Do not perform drag when pinching
      return;
    }

    // Otherwise, use single pointer for drag
    if (!dragStartTime) return;
    if (Date.now() - dragStartTime < DRAG_DELAY) return;

    const deltaX = e.clientX - lastPos.x;
    const deltaY = e.clientY - lastPos.y;

    setTheta(prevTheta => prevTheta + deltaX * rotationSensitivity);
    setPhi(prevPhi => {
      const newPhi = prevPhi - deltaY * rotationSensitivity;
      return Math.max(-90, Math.min(90, newPhi));
    });
    setLastPos({ x: e.clientX, y: e.clientY });
  }, [dragStartTime, lastPos, rotationSensitivity, zoom]);

  const handlePointerUp = useCallback((e) => {
    // Remove pointer from active list
    delete pointers.current[e.pointerId];
    if (Object.keys(pointers.current).length < 2) {
      initialPinchDistance.current = null;
      initialZoom.current = null;
    }
    if (Object.keys(pointers.current).length === 0) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      setDragStartTime(null);
    }
  }, []);

  const handlePointerCancel = useCallback((e) => {
    delete pointers.current[e.pointerId];
    if (Object.keys(pointers.current).length < 2) {
      initialPinchDistance.current = null;
      initialZoom.current = null;
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragStartTime(null);
  }, []);

  // Existing wheel event for desktop zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = Math.exp(e.deltaY * 0.001);
    setZoom(prev => Math.min(Math.max(prev * zoomFactor, 800), 3000));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        container.removeEventListener('wheel', handleWheel);
      };
    }
  }, [handleWheel]);

  useImperativeHandle(forwardedRef, () => ({
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

  const cubeTransform = `
    translate(-50%, -50%)
    rotateX(${phi}deg)
    rotateY(${theta}deg)
  `;

  return (
    <div
      className="cube-container"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{ touchAction: 'none' }}
      ref={containerRef}
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
