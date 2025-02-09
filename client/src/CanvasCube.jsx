// client/src/CanvasCube.jsx
import React, {
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import CanvasFace from './CanvasFace';
import './Cube.css';

const CUBE_SIZE = 600;
const GRID_SIZE = 64;

const CanvasCube = forwardRef(({ onBlockClick, layers, socket, isMuted }, forwardedRef) => {
  const containerRef = useRef(null);
  const [theta, setTheta] = useState(45);
  const [phi, setPhi] = useState(-30);
  const [dragStartTime, setDragStartTime] = useState(null);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1500);

  // Pointer handling variables
  const pointers = useRef({});
  const initialPinchDistance = useRef(null);
  const initialZoom = useRef(null);
  const lastPointerMoveTime = useRef(0);
  const rotationSensitivity = 0.2;
  const DRAG_DELAY = 150;

  const handleBlockRemove = useCallback((face, row, col) => {
    onBlockClick?.();
    if (socket) {
      socket.emit('removeBlock', { face, row, col });
    }
  }, [onBlockClick, socket]);

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
    if (now - lastPointerMoveTime.current < 16) return; // throttle ~60fps
    lastPointerMoveTime.current = now;

    pointers.current[e.pointerId] = { x: e.clientX, y: e.clientY };
    const activePointers = Object.keys(pointers.current);
    if (activePointers.length >= 2) {
      // Pinch-zoom branch.
      const [id1, id2] = activePointers;
      const p1 = pointers.current[id1];
      const p2 = pointers.current[id2];
      const currentDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (initialPinchDistance.current === null) {
        initialPinchDistance.current = currentDistance;
        initialZoom.current = zoom;
      } else {
        let newZoom = initialZoom.current * (initialPinchDistance.current / currentDistance);
        newZoom = Math.min(Math.max(newZoom, 700), 3000);
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
      faceNames.forEach(face => {
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
    },
  }));

  const cubeTransform = useMemo(() => `translate(-50%, -50%) rotateX(${phi}deg) rotateY(${theta}deg)`, [phi, theta]);

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
      <div className="cube-wrapper" style={{ perspective: `${zoom}px`, cursor: 'default' }}>
        <div className="cube" style={{ width: CUBE_SIZE, height: CUBE_SIZE, transform: cubeTransform }}>
          <CanvasFace
            layers={layers}
            faceName="front"
            handleClick={handleBlockRemove}
            transform={`translateZ(${CUBE_SIZE / 2}px)`}
            gridSize={GRID_SIZE}
            width={CUBE_SIZE}
            height={CUBE_SIZE}
          />
          <CanvasFace
            layers={layers}
            faceName="back"
            handleClick={handleBlockRemove}
            transform={`translateZ(${-CUBE_SIZE / 2}px) rotateY(180deg)`}
            gridSize={GRID_SIZE}
            width={CUBE_SIZE}
            height={CUBE_SIZE}
          />
          <CanvasFace
            layers={layers}
            faceName="top"
            handleClick={handleBlockRemove}
            transform={`translateY(${-CUBE_SIZE / 2}px) rotateX(90deg)`}
            gridSize={GRID_SIZE}
            width={CUBE_SIZE}
            height={CUBE_SIZE}
          />
          <CanvasFace
            layers={layers}
            faceName="bottom"
            handleClick={handleBlockRemove}
            transform={`translateY(${CUBE_SIZE / 2}px) rotateX(-90deg)`}
            gridSize={GRID_SIZE}
            width={CUBE_SIZE}
            height={CUBE_SIZE}
          />
          <CanvasFace
            layers={layers}
            faceName="left"
            handleClick={handleBlockRemove}
            transform={`translateX(${-CUBE_SIZE / 2}px) rotateY(-90deg)`}
            gridSize={GRID_SIZE}
            width={CUBE_SIZE}
            height={CUBE_SIZE}
          />
          <CanvasFace
            layers={layers}
            faceName="right"
            handleClick={handleBlockRemove}
            transform={`translateX(${CUBE_SIZE / 2}px) rotateY(90deg)`}
            gridSize={GRID_SIZE}
            width={CUBE_SIZE}
            height={CUBE_SIZE}
          />
        </div>
      </div>
    </div>
  );
});

export default CanvasCube;
