// Menu.jsx
import React from 'react';
import './Menu.css';

const Menu = ({ onShowLeaderboard, onShowUpgrades, points, onSignOut }) => (
  <div className="menu">
    <div className="points-display">Points: {points}</div>
    <button onClick={onShowLeaderboard}>Leaderboard</button>
    <button onClick={onShowUpgrades}>Upgrades</button>
    <button onClick={onSignOut}>Sign Out</button>
  </div>
);

export default Menu;