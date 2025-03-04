import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo, useCallback, useRef } from 'react';
import './Cube.css';

const CUBE_SIZE = 600;
const GRID_SIZE = 64;

// Add deep, resonant sound effect as base64 data
const SOUND_DATA = 'data:audio/wav;base64,UklGRiQDAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQADAAD//v38+/r5+Pb19PTz8vLx8fDw8PDw8PHx8vP09fb3+Pn6+/z9/v8AAQIDBAUGBwgICQoLCwwMDQ0NDQ0NDAwMCwoKCQgHBwYFBAMCAQD//v38+/r5+Pf29fTz8vLx8fDw8PDw8fHy8/T19vf4+fr7/P3+/wABAgMEBQYHCAgJCgsLDAwNDQ0NDQ0MDAsPpIKpfwQGBwMAAQD+/fz7+vn49/b19PPy8vHx8PDw8PHx8vP09fb3+Pn6+/z9/v8AAQIDBAUGBwgJCQoLCwwNDQ0NDQ0NDAwLCwoJCAcHBgUEAwIBAP/+/fz7+vn49/b19PPy8vHx8PDw8PHx8vP09fb3+Pn6+/z9/v8AAQIDBAUGBwgJCQoLCwwMDQ0NDQ0NDAwLCwoJCQcHBgUEAwIBAP/+/fz7+vn49/b19PPy8vHx8PDw8PHx8vP09fb3+Pn6+/z9/v8AAQIDBAUGBwgICQoKCwwMDQ0NDQ0NDAwLCwoJCQgHBgUEAwIBAP/+/fz7+vn49/b19PPy8vHw8PDw8PHx8vP09fb3+Pn6+/z9/v8AAQIDBAUGBwgICQoLCwwMDQ0NDQ0NDAwLCwoJCAcHBgUEAwIBAP/+/fz7+vn49/b19PPy8fHw8PDw8PHx8vP09fb3+Pn6+/z9/v8AAQIDBAUGBwgICQoLCwwMDQ0NDQ0NDAwLCwoJCAcHBgUEAwIBAP/+/fz7+vn49/b19PPy8fHx8PDw8PHx8vP09fb3+Pn6+/z9/v8AAQIDBAUGBwgJCQoLCwwMDQ0NDQ0NDAwLCwoJCAcHBgUEAwIB';

// Particle pool to reuse DOM elements
const particlePool = [];
const MAX_POOL_SIZE = 15; // Maximum number of particles to keep in the pool

// Global click throttling for rapid clicking
let isThrottlingGlobal = false;
const GLOBAL_THROTTLE_TIME = 15; // Reduced from 20ms to 15ms for more responsive clicking

// Create a pool of audio elements for better performance
const audioPool = [];
for (let i = 0; i < 5; i++) { // Increase pool size from 3 to 5 for smoother playback
  const audio = new Audio(SOUND_DATA);
  audio.volume = 0.3; // Slightly increase volume for the deeper sound
  audioPool.push(audio);
}
let lastAudioIndex = 0;

const createBlockParticles = (e, blockColor, face, position) => {
  // Get target element and its position
  const rect = e.target.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // Limit particles for better performance
  const particleCount = 1; // Reduced from random 1-2 to fixed 1 for better performance
  const particles = [];
  
  // Prepare all particles first
  for (let i = 0; i < particleCount; i++) {
    // Try to get a particle from the pool first
    let particle = particlePool.pop();
    let isNewParticle = false;
    
    if (!particle) {
      // Create a new particle if none available in the pool
      particle = document.createElement('div');
      particle.className = 'block-particle';
      document.body.appendChild(particle);
      isNewParticle = true;
    } else {
      // Reset the existing particle
      particle.style.opacity = '1';
    }
    
    // Initial setup
    particle.style.backgroundColor = blockColor;
    const size = Math.random() * 8 + 5; // Reduced size for better performance
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    
    let px = centerX + (Math.random() - 0.5) * 5;
    let py = centerY + (Math.random() - 0.5) * 5;
    particle.style.left = `${px}px`;
    particle.style.top = `${py}px`;
    
    // Calculate motion parameters
    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 0.3 + 0.2;
    
    // Store particle data
    particles.push({
      element: particle,
      px,
      py,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      size,
      frame: 0,
      isNewParticle
    });
  }
  
  // Use a single animation frame for all particles
  const maxFrames = 80; // Reduced from 100 to 80 frames for faster animation
  const gravity = -0.005;
  
  function animateAll() {
    let allComplete = true;
    
    // Update all particles in a single frame
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.frame++;
      
      // Update position
      p.vy += gravity;
      p.px += p.vx;
      p.py += p.vy;
      
      // Calculate size and opacity
      const sizeRatio = 1 - p.frame / maxFrames;
      let opacity = 1;
      if (p.frame > maxFrames * 0.5) {
        opacity = 1 - (p.frame - maxFrames * 0.5) / (maxFrames * 0.5);
      }
      
      // Apply updates in a batch
      const elem = p.element;
      elem.style.width = `${p.size * sizeRatio}px`;
      elem.style.height = `${p.size * sizeRatio}px`;
      elem.style.left = `${p.px}px`;
      elem.style.top = `${p.py}px`;
      elem.style.opacity = opacity;
      
      // Check if this particle is still animating
      if (p.frame < maxFrames) {
        allComplete = false;
      } else {
        // Return to pool or remove
        if (particlePool.length < MAX_POOL_SIZE) {
          elem.style.opacity = '0';
          particlePool.push(elem);
        } else if (p.isNewParticle) {
          elem.remove();
        }
      }
    }
    
    // Continue animation if any particles are still active
    if (!allComplete) {
      requestAnimationFrame(animateAll);
    }
  }
  
  // Start animation in next frame
  requestAnimationFrame(animateAll);
};

const Block = React.memo(({ isTopLayer, blockColor, row, col, faceName, handleClick }) => {
  const blockStyle = useMemo(() => ({
    backgroundColor: blockColor,
    gridRow: row + 1,
    gridColumn: col + 1,
    cursor: isTopLayer ? 'pointer' : 'default',
    touchAction: 'none'
  }), [blockColor, row, col, isTopLayer]);
  
  const onClick = useCallback((e) => {
    e.stopPropagation();
    
    if (!isTopLayer || isThrottlingGlobal) return;
    
    // Global throttle for rapid clicking
    isThrottlingGlobal = true;
    setTimeout(() => {
      isThrottlingGlobal = false;
    }, GLOBAL_THROTTLE_TIME);
    
    // Handle click immediately
    handleClick(faceName, row, col);
    
    // Create particles in the next animation frame to reduce lag
    requestAnimationFrame(() => {
      createBlockParticles(e, blockColor, faceName, { row, col });
    });
  }, [isTopLayer, blockColor, row, col, faceName, handleClick]);
  
  return (
    <button
      onPointerDown={onClick}
      className="grid-block"
      style={blockStyle}
    />
  );
}, (prevProps, nextProps) => 
  prevProps.isTopLayer === nextProps.isTopLayer &&
  prevProps.blockColor === nextProps.blockColor &&
  prevProps.row === nextProps.row &&
  prevProps.col === nextProps.col
);

const Face = React.memo(({ layers, faceName, handleClick, transform, gridSize }) => {
  // We'll handle debouncing at the block level, so we can simplify this
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
            <Block
              key={`${i}-${j}`}
              isTopLayer={isTopLayer}
              blockColor={blockColor}
              row={i}
              col={j}
              faceName={faceName}
              handleClick={handleClick}
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
  const [dragStartTime, setDragStartTime] = useState(null);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1500);
  const [lastPlayTime, setLastPlayTime] = useState(0);

  // For pointer tracking and throttling
  const pointers = useRef({});
  const initialPinchDistance = useRef(null);
  const initialZoom = useRef(null);
  const lastPointerMoveTime = useRef(0);

  const rotationSensitivity = 0.2;
  const DRAG_DELAY = 150;

  // Simple function to play a sound using our audio pool
  const playSound = useCallback(() => {
    if (isMuted) return;
    
    const now = Date.now();
    if (now - lastPlayTime < 25) return; // Slightly reduce throttling time for more responsive sound
    setLastPlayTime(now);
    
    // Schedule sound playback in the next animation frame to reduce main thread blocking
    requestAnimationFrame(() => {
      // Get the next audio element from the pool
      lastAudioIndex = (lastAudioIndex + 1) % audioPool.length;
      const audio = audioPool[lastAudioIndex];
      
      // Reset and play
      audio.currentTime = 0;
      audio.play().catch(e => console.log("Audio play error:", e));
    });
  }, [isMuted, lastPlayTime]);

  const handleBlockRemove = useCallback((face, row, col) => {
    // Play sound immediately
    playSound();
    
    // Call the click callback immediately to update local state
    onBlockClick?.();
    
    // Emit the socket event in the next event loop tick to avoid blocking the UI
    if (socket) {
      setTimeout(() => {
        socket.emit('removeBlock', { face, row, col });
      }, 0);
    }
  }, [socket, onBlockClick, playSound]);

  const handlePointerDown = useCallback((e) => {
    pointers.current[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (Object.keys(pointers.current).length === 1) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragStartTime(Date.now());
      setLastPos({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handlePointerMove = useCallback((e) => {
    const now = Date.now();
    if (now - lastPointerMoveTime.current < 16) return; // Throttle to ~60fps
    lastPointerMoveTime.current = now;

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
        let newZoom = initialZoom.current * (initialPinchDistance.current / currentDistance);
        newZoom = Math.min(Math.max(newZoom, 700), 4500);
        setZoom(newZoom);
      }
      return;
    }

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

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const zoomFactor = Math.exp(e.deltaY * 0.001);
    setZoom(prev => Math.min(Math.max(prev * zoomFactor, 700), 4500));
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
      
      // Find visible blocks in a more optimized way (avoid unnecessary loops)
      const faceNames = ['front', 'back', 'top', 'bottom', 'left', 'right'];
      const visibleBlocks = [];

      // Only check the top layer (index 0) for performance
      const topLayer = layers[0];
      
      for (let faceIndex = 0; faceIndex < faceNames.length; faceIndex++) {
        const face = faceNames[faceIndex];
        const grid = topLayer[face];
        
        for (let rowIndex = 0; rowIndex < grid.length; rowIndex++) {
          const row = grid[rowIndex];
          for (let colIndex = 0; colIndex < row.length; colIndex++) {
            if (row[colIndex]) {
              visibleBlocks.push({ face, row: rowIndex, col: colIndex });
            }
          }
        }
      }

      if (visibleBlocks.length > 0) {
        const randomIndex = Math.floor(Math.random() * visibleBlocks.length);
        const { face, row, col } = visibleBlocks[randomIndex];
        handleBlockRemove(face, row, col);
      }
    }
  }), [layers, handleBlockRemove]);

  const cubeTransform = useMemo(
    () => `translate(-50%, -50%) rotateX(${phi}deg) rotateY(${theta}deg)`,
    [phi, theta]
  );
  const cubeWrapperStyle = useMemo(() => ({ perspective: `${zoom}px` }), [zoom]);

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
      <div className="cube-wrapper" style={cubeWrapperStyle}>
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
