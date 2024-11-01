// src/App.js

import React, { useState, useEffect, useRef } from 'react';
import Cube from './Cube';
import Menu from './Menu';
import Upgrades from './Upgrades';
import './App.css';

function App() {
  const [points, setPoints] = useState(0);
  const [ownedUpgrades, setOwnedUpgrades] = useState([]);
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Ref to access Cube methods
  const cubeRef = useRef();

  // Define available upgrades
  const upgrades = [
    { name: 'Double Points', cost: 50, effect: 'double' },
    { name: 'Auto Clicker', cost: 100, effect: 'autoClicker' },
  ];

  // Handle block click (from manual clicking or autoclicker)
  const handleBlockClick = () => {
    let pointsEarned = 1;

    // Check if 'Double Points' upgrade is owned
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

  // Implement auto-clicker effect
  useEffect(() => {
    let interval;
    if (ownedUpgrades.includes('autoClicker')) {
      interval = setInterval(() => {
        // Remove a random block from the cube
        if (cubeRef.current) {
          cubeRef.current.removeRandomBlock();
        }
      }, 1000); // Adjust the interval as needed (e.g., every second)
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [ownedUpgrades]);

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
      {/* Leaderboard placeholder */}
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
      <Cube onBlockClick={handleBlockClick} ref={cubeRef} />
    </div>
  );
}

export default App;
