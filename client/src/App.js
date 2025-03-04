import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Cube from './Cube';
import Menu from './Menu';
import Upgrades from './Upgrades';
import Leaderboard from './Leaderboard';
import './App.css';
import { io } from 'socket.io-client';

// Memoize components for better performance
const MemoMenu = React.memo(Menu);
const MemoUpgrades = React.memo(Upgrades);
const MemoLeaderboard = React.memo(Leaderboard);

function App({ keycloak }) {
  const [points, setPoints] = useState(0);
  const [ownedUpgrades, setOwnedUpgrades] = useState([]);
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [layers, setLayers] = useState(null);
  const [currentLayer, setCurrentLayer] = useState(1);
  const [nukerCooldown, setNukerCooldown] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const cubeRef = useRef();
  const [socket, setSocket] = useState(null);

  const upgrades = useMemo(() => ([
    { name: 'Double Points', cost: 50, effect: 'double' },
    { name: 'Double Points Pro', cost: 3000, effect: 'doublePro' },
    { name: 'Double Points MAX', cost: 30000, effect: 'doubleMax' },
    { name: 'Auto Clicker', cost: 100, effect: 'autoClicker' },
    { name: 'Fast Auto Clicker', cost: 5000, effect: 'autoClickerFast' },
    { name: 'Ultra Auto Clicker', cost: 50000, effect: 'autoClickerUltra' },
    { name: 'Layer Nuker', cost: 1000000, effect: 'nuker' },
  ]), []);

  useEffect(() => {
    if (keycloak && keycloak.authenticated) {
      console.log('Creating socket with token:', keycloak.token.substring(0, 20) + '...');
      console.log('Keycloak config:', {
        url: keycloak.authServerUrl,
        realm: keycloak.realm,
        clientId: keycloak.clientId
      });

      // Determine if we're in development or production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      // Configure socket connection based on environment
      const socketConfig = isDevelopment 
        ? {
            // In development, connect directly to the server
            url: 'http://localhost:4000',
            options: {
              auth: { token: keycloak.token },
              transports: ['websocket'],
            }
          }
        : {
            // In production, use the existing configuration
            url: '/',
            options: {
              path: '/api/socket.io',
              auth: { token: keycloak.token },
              transports: ['websocket'],
            }
          };
      
      console.log('Socket configuration:', socketConfig);
      
      const newSocket = io(socketConfig.url, socketConfig.options);

      newSocket.on('connect', () => {
        console.log('Socket connected successfully');
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error details:', {
          message: error.message,
          data: error.data,
          description: error.description
        });
      });

      newSocket.on('cubeStateUpdate', (updatedLayers) => {
        console.log('Received cube state update:', {
          hasLayers: !!updatedLayers,
          layerCount: updatedLayers?.length
        });
        setLayers(updatedLayers);
      });

      newSocket.on('currentLayer', (layer) => {
        console.log('Received current layer:', layer);
        setCurrentLayer(layer);
      });

      newSocket.on('userData', (userData) => {
        console.log('Received user data:', {
          points: userData.points,
          upgradeCount: userData.ownedUpgrades?.length
        });
        setPoints(userData.points);
        setOwnedUpgrades(userData.ownedUpgrades);
      });

      setSocket(newSocket);

      return () => {
        console.log('Cleaning up socket connection');
        newSocket.disconnect();
      };
    }
  }, [keycloak]);

  const handleBlockClick = useCallback(() => {
    // For manual clicks, send base point value (1) to server
    // Server will handle applying multipliers consistently
    if (socket) {
      socket.emit('updatePoints', { points: 1 });
    } else {
      // Fallback for offline mode
      let pointsEarned = 1;
      if (ownedUpgrades.includes('double')) pointsEarned *= 2;
      if (ownedUpgrades.includes('doublePro')) pointsEarned *= 2;
      if (ownedUpgrades.includes('doubleMax')) pointsEarned *= 2;
      setPoints((prev) => prev + pointsEarned);
    }
  }, [ownedUpgrades, socket]);

  const handleNuker = useCallback(() => {
    if (ownedUpgrades.includes('nuker') && !nukerCooldown && socket) {
      socket.emit('nukeLayer');
      setNukerCooldown(true);
      setTimeout(() => setNukerCooldown(false), 1800000); // 30 minutes
    }
  }, [ownedUpgrades, nukerCooldown, socket]);

  const handleShowLeaderboard = useCallback(() => {
    setShowLeaderboard(true);
  }, []);

  const handleCloseLeaderboard = useCallback(() => {
    setShowLeaderboard(false);
  }, []);

  const handleShowUpgrades = useCallback(() => {
    setShowUpgrades(true);
  }, []);

  const handleCloseUpgrades = useCallback(() => {
    setShowUpgrades(false);
  }, []);

  const handleSignOut = useCallback(() => {
    if (socket) {
      socket.disconnect();
    }
    keycloak.logout();
  }, [socket, keycloak]);

  const handleToggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const handlePurchaseUpgrade = useCallback((upgrade) => {
    if (points >= upgrade.cost && !ownedUpgrades.includes(upgrade.effect) && socket) {
      setPoints((prevPoints) => prevPoints - upgrade.cost);
      setOwnedUpgrades((prevUpgrades) => [...prevUpgrades, upgrade.effect]);
      socket.emit('purchaseUpgrade', { upgrade: upgrade.effect });
    }
  }, [points, ownedUpgrades, socket]);

  useEffect(() => {
    let interval;
    if (layers && socket) {
      let delay = 1000;
      if (ownedUpgrades.includes('autoClickerUltra')) delay = 500;
      else if (ownedUpgrades.includes('autoClickerFast')) delay = 1000;
      else if (ownedUpgrades.includes('autoClicker')) delay = 2000;
      
      if (ownedUpgrades.some(upgrade => upgrade.startsWith('autoClicker'))) {
        interval = setInterval(() => {
          if (cubeRef.current) {
            cubeRef.current.requestRandomBlockRemoval();
          }
        }, delay);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [ownedUpgrades, layers, socket]);

  if (!layers) {
    console.log('No layers available, showing loading state');
    return <div className="App">Loading cube...</div>;
  }

  return (
    <div className="App">
      <MemoMenu
        onShowLeaderboard={handleShowLeaderboard}
        onShowUpgrades={handleShowUpgrades}
        points={points}
        currentLayer={currentLayer}
        onSignOut={handleSignOut}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        ownedUpgrades={ownedUpgrades}
        nukerCooldown={nukerCooldown}
        onNuker={handleNuker}
      />
      {showUpgrades && (
        <MemoUpgrades
          points={points}
          upgrades={upgrades}
          ownedUpgrades={ownedUpgrades}
          onPurchase={handlePurchaseUpgrade}
          onClose={handleCloseUpgrades}
          nukerCooldown={nukerCooldown}
          onNuker={handleNuker}
        />
      )}
      {showLeaderboard && (
        <MemoLeaderboard
          socket={socket}
          onClose={handleCloseLeaderboard}
        />
      )}
      <Cube
        onBlockClick={handleBlockClick}
        ref={cubeRef}
        layers={layers}
        socket={socket}
        isMuted={isMuted}
      />
    </div>
  );
}

export default App;
