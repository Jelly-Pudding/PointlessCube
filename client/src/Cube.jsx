import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo, useCallback } from 'react';
import './Cube.css';

const CUBE_SIZE = 600;
const GRID_SIZE = 32;

const audioContext = new AudioContext();
const gainNode = audioContext.createGain();
gainNode.connect(audioContext.destination);

const particleColors = ['#FF3B3B', '#3BFF3B', '#3B3BFF', '#FFEB3B', '#FF3BFF'];

const createParticles = (x, y) => {
  const particleCount = 8; 
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    document.body.appendChild(particle);

    // Smaller, fewer particles
    const size = Math.random() * 2 + 1; 
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.backgroundColor = particleColors[Math.floor(Math.random() * particleColors.length)];

    // Slight random offset
    let px = x + (Math.random() - 0.5) * 5;
    let py = y + (Math.random() - 0.5) * 5;

    particle.style.left = `${px}px`;
    particle.style.top = `${py}px`;

    const angle = Math.random() * Math.PI * 2;
    const velocity = (Math.random() * 1.5) + 0.5; // Less initial speed
    let vx = Math.cos(angle) * velocity;
    let vy = Math.sin(angle) * velocity;

    let frame = 0;
    const maxFrames = 40; // Shorter lifetime (~0.67s)

    const animate = () => {
      frame++;
      px += vx;
      py += vy;

      particle.style.left = `${px}px`;
      particle.style.top = `${py}px`;

      // More friction, so they don't go far
      vx *= 0.85;
      vy *= 0.85;

      // Fade out near the end
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

const playBreakSound = (isMuted) => {
  if (isMuted) return;
  
  const oscillator = audioContext.createOscillator();
  const tempGain = audioContext.createGain();
  
  oscillator.connect(tempGain);
  tempGain.connect(audioContext.destination);

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
  tempGain.gain.setValueAtTime(0.2, audioContext.currentTime);
  oscillator.start(audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1);
  tempGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
  oscillator.stop(audioContext.currentTime + 0.15);
};

const Face = React.memo(({ displayLayers, faceName, handleClick, transform, gridSize }) => {
  const blocks = useMemo(() => {
    const visibleBlocks = [];
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        if (displayLayers[0][faceName][i][j]) {
          visibleBlocks.push(
            <button
              key={`${i}-${j}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                const rect = e.target.getBoundingClientRect();
                const x = rect.left + rect.width / 2;
                const y = rect.top + rect.height / 2;

                createParticles(x, y);

                // No pop animation now - remove for immediate feedback

                handleClick(faceName, i, j);
              }}
              className="grid-block"
              style={{
                backgroundColor: displayLayers[0].color,
                gridRow: i + 1,
                gridColumn: j + 1,
                cursor: 'pointer',
                touchAction: 'none'
              }}
            />
          );
        } else if (displayLayers[1][faceName][i][j]) {
          visibleBlocks.push(
            <button
              key={`${i}-${j}`}
              className="grid-block"
              style={{
                backgroundColor: displayLayers[1].color,
                gridRow: i + 1,
                gridColumn: j + 1,
                cursor: 'default',
                touchAction: 'none',
                opacity: 0.8
              }}
            />
          );
        } else {
          // If no block in top layer and no block in second layer, no button is needed.
          // This helps ensure an immediate disappearance of the block.
        }
      }
    }
    return visibleBlocks;
  }, [displayLayers, faceName, handleClick, gridSize]);

  return (
    <div className="face" style={{ transform }}>
      <div className="grid-container" style={{ '--grid-size': gridSize }}>
        {blocks}
      </div>
    </div>
  );
});

const Cube = forwardRef(({ onBlockClick, layers, socket, isMuted }, ref) => {
  const [displayLayers, setDisplayLayers] = useState(layers);

  useEffect(() => {
    // Sync displayLayers with server-updated layers whenever layers prop changes
    setDisplayLayers(layers);
  }, [layers]);

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
    if (displayLayers[0][face][row][col]) {
      // Optimistic update: remove block immediately
      const newDisplayLayers = JSON.parse(JSON.stringify(displayLayers));
      newDisplayLayers[0][face][row][col] = false;
      setDisplayLayers(newDisplayLayers);

      playBreakSound(isMuted);
      onBlockClick?.();
      socket.emit('removeBlock', { face, row, col });
    }
  }, [displayLayers, isMuted, onBlockClick, socket]);

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
      if (!displayLayers) return;
      const faceNames = ['front', 'back', 'top', 'bottom', 'left', 'right'];
      const visibleBlocks = [];

      faceNames.forEach((face) => {
        displayLayers[0][face].forEach((row, rowIndex) => {
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
  }), [displayLayers, handleBlockRemove]);

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
            displayLayers={displayLayers}
            faceName="front"
            handleClick={handleBlockRemove}
            transform={`translateZ(${CUBE_SIZE / 2}px)`}
            gridSize={GRID_SIZE}
          />
          <Face
            displayLayers={displayLayers}
            faceName="back"
            handleClick={handleBlockRemove}
            transform={`translateZ(${-CUBE_SIZE / 2}px) rotateY(180deg)`}
            gridSize={GRID_SIZE}
          />
          <Face
            displayLayers={displayLayers}
            faceName="top"
            handleClick={handleBlockRemove}
            transform={`translateY(${-CUBE_SIZE / 2}px) rotateX(90deg)`}
            gridSize={GRID_SIZE}
          />
          <Face
            displayLayers={displayLayers}
            faceName="bottom"
            handleClick={handleBlockRemove}
            transform={`translateY(${CUBE_SIZE / 2}px) rotateX(-90deg)`}
            gridSize={GRID_SIZE}
          />
          <Face
            displayLayers={displayLayers}
            faceName="left"
            handleClick={handleBlockRemove}
            transform={`translateX(${-CUBE_SIZE / 2}px) rotateY(-90deg)`}
            gridSize={GRID_SIZE}
          />
          <Face
            displayLayers={displayLayers}
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
