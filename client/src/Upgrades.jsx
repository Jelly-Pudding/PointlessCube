// Upgrades.jsx

import React from 'react';
import './Upgrades.css';

const Upgrades = ({ points, upgrades, ownedUpgrades, onPurchase, onClose }) => (
  <div className="overlay">
    <div className="overlay-content">
      <h2>Upgrades</h2>
      <button className="close-button" onClick={onClose}>
        X
      </button>
      <div className="points-display">Points: {points}</div>
      <ul>
        {upgrades.map((upgrade) => (
          <li key={upgrade.name}>
            <span>{upgrade.name} - Cost: {upgrade.cost} points</span>
            <button
              onClick={() => onPurchase(upgrade)}
              disabled={points < upgrade.cost || ownedUpgrades.includes(upgrade.effect)}
            >
              {ownedUpgrades.includes(upgrade.effect) ? 'Owned' : 'Buy'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export default Upgrades;
