// src/App.js
import React, { useState, useEffect, useRef } from 'react';
import Cube from './Cube';
import Menu from './Menu';
import Upgrades from './Upgrades';
import Leaderboard from './Leaderboard';
import './App.css';
import { io } from 'socket.io-client';
import Keycloak from 'keycloak-js';

function App({ keycloak }) {
  const [points, setPoints] = useState(0);
  const [ownedUpgrades, setOwnedUpgrades] = useState([]);
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [layers, setLayers] = useState(null);
  const cubeRef = useRef();
  const [socket, setSocket] = useState(null);

  const upgrades = [
    { name: 'Double Points', cost: 50, effect: 'double' },
    { name: 'Auto Clicker', cost: 100, effect: 'autoClicker' },
  ];

  useEffect(() => {
    if (keycloak && keycloak.authenticated) {
      // Establish socket connection with token
      const newSocket = io('/', {
        path: '/api/socket.io',
        auth: { token: keycloak.token },
        transports: ['websocket'],
      });

      newSocket.on('connect', () => {
        console.log('Connected to Socket.io server');
        if (keycloak.tokenParsed) {
          newSocket.emit('updateUsername', keycloak.tokenParsed.preferred_username);
        }
      });

      newSocket.on('cubeStateUpdate', (updatedLayers) => {
        setLayers(updatedLayers);
      });

      newSocket.on('userData', (userData) => {
        setPoints(userData.points);
        setOwnedUpgrades(userData.ownedUpgrades);
      });

      setSocket(newSocket);

      // Clean up on unmount
      return () => {
        newSocket.off('cubeStateUpdate');
        newSocket.off('userData');
        newSocket.disconnect();
      };
    }
  }, [keycloak]);

  const handleBlockClick = () => {
    let pointsEarned = 1;
    if (ownedUpgrades.includes('double')) {
      pointsEarned *= 2;
    }
    setPoints((prev) => prev + pointsEarned);
    socket.emit('updatePoints', { points: pointsEarned });
  };

  const handleShowLeaderboard = () => {
    setShowLeaderboard(true);
  };

  const handleCloseLeaderboard = () => {
    setShowLeaderboard(false);
  };

  const handleShowUpgrades = () => {
    setShowUpgrades(true);
  };

  const handleCloseUpgrades = () => {
    setShowUpgrades(false);
  };

  const handlePurchaseUpgrade = (upgrade) => {
    if (points >= upgrade.cost && !ownedUpgrades.includes(upgrade.effect)) {
      setPoints((prevPoints) => prevPoints - upgrade.cost);
      setOwnedUpgrades((prevUpgrades) => [...prevUpgrades, upgrade.effect]);
      socket.emit('purchaseUpgrade', { upgrade: upgrade.effect });
    }
  };

  useEffect(() => {
    let interval;
    if (ownedUpgrades.includes('autoClicker') && layers && socket) {
      interval = setInterval(() => {
        if (cubeRef.current) {
          cubeRef.current.requestRandomBlockRemoval();
        }
      }, 1000);
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
      />
      {showUpgrades && (
        <Upgrades
          points={points}
          upgrades={upgrades}
          ownedUpgrades={ownedUpgrades}
          onPurchase={handlePurchaseUpgrade}
          onClose={handleCloseUpgrades}
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
      />
    </div>
  );
}

export default App;