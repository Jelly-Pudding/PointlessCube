// Menu.jsx

import React from 'react';
import './Menu.css';

const Menu = ({ onShowLeaderboard, onShowUpgrades, points }) => (
  <div className="menu">
    <div className="points-display">Points: {points}</div>
    <button onClick={onShowLeaderboard}>Leaderboard</button>
    <button onClick={onShowUpgrades}>Upgrades</button>
  </div>
);

export default Menu;
