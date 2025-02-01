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

    const size = Math.random() * 6 + 4;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;

    let px = centerX + (Math.random() - 0.5) * 5;
    let py = centerY + (Math.random() - 0.5) * 5;

    particle.style.left = `${px}px`;
    particle.style.top = `${py}px`;

    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 1 + 0.5;
    let vx = Math.cos(angle) * velocity;
    let vy = Math.sin(angle) * velocity;

    let frame = 0;
    const maxFrames = 40;
    const gravity = 0.15;

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

      if (frame > maxFrames * 0.7) {
        const fadeRatio = 1 - (frame - maxFrames * 0.7) / (maxFrames * 0.3);
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

  // Updated pointer handlers with pointer capture for mouse support
  const handlePointerDown = useCallback((e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragStartTime(Date.now());
    setLastPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handlePointerMove = useCallback((e) => {
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

  const handlePointerUp = useCallback((e) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
    setDragStartTime(null);
  }, []);

  const handlePointerCancel = useCallback((e) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
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

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const wheelHandler = (e) => handleWheel(e);
      container.addEventListener('wheel', wheelHandler, { passive: false });
      return () => {
        container.removeEventListener('wheel', wheelHandler);
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
