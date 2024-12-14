import React from 'react';
import './Menu.css';

const Menu = ({ onShowLeaderboard, onShowUpgrades, points, currentLayer, onSignOut }) => (
  <div className="menu">
    <div className="points-display">Points: {points}</div>
    <div className="layer-display">Layer: {currentLayer}</div>
    <button onClick={onShowLeaderboard}>Leaderboard</button>
    <button onClick={onShowUpgrades}>Upgrades</button>
    <button onClick={onSignOut}>Sign Out</button>
  </div>
);

export default Menu;
