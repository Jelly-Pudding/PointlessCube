// src/App.js
import React, { useState, useEffect, useRef } from 'react';
import Cube from './Cube';
import Menu from './Menu';
import Upgrades from './Upgrades';
import './App.css';
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000'); // Adjust if needed

function App() {
  const [points, setPoints] = useState(0);
  const [ownedUpgrades, setOwnedUpgrades] = useState([]);
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [layers, setLayers] = useState(null);

  const cubeRef = useRef();

  const upgrades = [
    { name: 'Double Points', cost: 50, effect: 'double' },
    { name: 'Auto Clicker', cost: 100, effect: 'autoClicker' },
  ];

  const handleBlockClick = () => {
    let pointsEarned = 1;
    if (ownedUpgrades.includes('double')) {
      pointsEarned *= 2;
    }
    setPoints((prevPoints) => prevPoints + pointsEarned);
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
    }
  };

  // For autoclicker, we now need the server to remove blocks.
  // We'll emit removeBlock events to the server.
  useEffect(() => {
    let interval;
    if (ownedUpgrades.includes('autoClicker') && layers) {
      interval = setInterval(() => {
        // Remove a random block via the server
        if (cubeRef.current) {
          cubeRef.current.requestRandomBlockRemoval();
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [ownedUpgrades, layers]);

  // Socket.io setup
  useEffect(() => {
    socket.on('cubeStateUpdate', (updatedLayers) => {
      setLayers(updatedLayers);
    });

    return () => {
      socket.off('cubeStateUpdate');
    };
  }, []);

  // If layers is null, we haven't received the state from the server yet
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
        <div className="overlay">
          <div className="overlay-content">
            <h2>Leaderboard</h2>
            <button className="close-button" onClick={handleCloseLeaderboard}>
              X
            </button>
            <p>Leaderboard feature coming soon!</p>
          </div>
        </div>
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
