// Upgrades.jsx
import React from 'react';
import './Upgrades.css';

const Upgrades = ({ points, upgrades, ownedUpgrades, onPurchase, onClose, nukerCooldown, onNuker }) => (
  <div className="overlay">
    <div className="overlay-content">
      <h2>Upgrades</h2>
      <button className="close-button" onClick={onClose}>X</button>
      <div className="points-display">Available Points: {points}</div>
      <ul>
        {upgrades.map((upgrade) => {
          const owned = ownedUpgrades.includes(upgrade.effect);
          const affordable = points >= upgrade.cost;
          const isNuker = upgrade.effect === 'nuker';
          
          return (
            <li key={upgrade.effect}>
              <span>{upgrade.name} - {upgrade.cost} points</span>
              {isNuker && owned ? (
                <button
                  onClick={onNuker}
                  disabled={nukerCooldown}
                >
                  {nukerCooldown ? 'Cooldown (30m)' : 'Use Nuker'}
                </button>
              ) : (
                <button
                  onClick={() => onPurchase(upgrade)}
                  disabled={owned || !affordable}
                >
                  {owned ? 'Owned' : affordable ? 'Buy' : 'Too Expensive'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  </div>
);

export default Upgrades;
