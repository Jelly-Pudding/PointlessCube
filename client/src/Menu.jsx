import React from 'react';
import './Menu.css';

const Menu = ({ onShowLeaderboard, onShowUpgrades, points, currentLayer, onSignOut, isMuted, onToggleMute, ownedUpgrades, nukerCooldown, onNuker }) => (
  <div className="menu">
    <div className="points-display">Points: {points}</div>
    <div className="layer-display">Layer: {currentLayer}</div>
    <button onClick={onShowLeaderboard}>Leaderboard</button>
    <button onClick={onShowUpgrades}>Upgrades</button>
    {ownedUpgrades && ownedUpgrades.includes('nuker') && (
      <button 
        onClick={onNuker} 
        disabled={nukerCooldown}
        className={nukerCooldown ? 'disabled' : ''}
      >
        {nukerCooldown ? 'Nuker Cooldown' : 'Use Nuker'}
      </button>
    )}
    <button onClick={onToggleMute}>{isMuted ? 'Unmute' : 'Mute'}</button>
    <button onClick={onSignOut}>Sign Out</button>
  </div>
);

export default Menu;
