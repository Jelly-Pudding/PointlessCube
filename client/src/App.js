import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Cube from './Cube';
import Menu from './Menu';
import Upgrades from './Upgrades';
import Leaderboard from './Leaderboard';
import './App.css';
import { io } from 'socket.io-client';

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

  // Memoize the upgrades array so it isn’t re‑created on every render
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
      const newSocket = io('/', {
        path: '/api/socket.io',
        auth: { token: keycloak.token },
        transports: ['websocket'],
      });

      const handleConnect = () => {
        console.log('Connected to Socket.io server');
        if (keycloak.tokenParsed) {
          newSocket.emit('updateUsername', keycloak.tokenParsed.preferred_username);
        }
      };

      const handleCubeStateUpdate = (updatedLayers) => {
        setLayers(updatedLayers);
      };

      const handleCurrentLayer = (layer) => {
        setCurrentLayer(layer);
      };

      const handleUserData = (userData) => {
        setPoints(userData.points);
        setOwnedUpgrades(userData.ownedUpgrades);
      };

      newSocket.on('connect', handleConnect);
      newSocket.on('cubeStateUpdate', handleCubeStateUpdate);
      newSocket.on('currentLayer', handleCurrentLayer);
      newSocket.on('userData', handleUserData);

      setSocket(newSocket);

      return () => {
        newSocket.off('connect', handleConnect);
        newSocket.off('cubeStateUpdate', handleCubeStateUpdate);
        newSocket.off('currentLayer', handleCurrentLayer);
        newSocket.off('userData', handleUserData);
        newSocket.disconnect();
      };
    }
  }, [keycloak]);

  const handleBlockClick = useCallback(() => {
    let pointsEarned = 1;
    if (ownedUpgrades.includes('double')) pointsEarned *= 2;
    if (ownedUpgrades.includes('doublePro')) pointsEarned *= 2;
    if (ownedUpgrades.includes('doubleMax')) pointsEarned *= 2;
    setPoints((prev) => prev + pointsEarned);
    if (socket) {
      socket.emit('updatePoints', { points: pointsEarned });
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
      if (ownedUpgrades.includes('autoClickerUltra')) delay = 100;
      else if (ownedUpgrades.includes('autoClickerFast')) delay = 250;
      else if (ownedUpgrades.includes('autoClicker')) delay = 1000;
      
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
    return <div className="App">Loading cube...</div>;
  }

  return (
    <div className="App">
      <Menu
        onShowLeaderboard={handleShowLeaderboard}
        onShowUpgrades={handleShowUpgrades}
        points={points}
        currentLayer={currentLayer}
        onSignOut={handleSignOut}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />
      {showUpgrades && (
        <Upgrades
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
        <Leaderboard
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
