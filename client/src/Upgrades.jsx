// Upgrades.jsx
import React from 'react';
import './Upgrades.css';

const upgradeCategories = {
  points: {
    title: 'Point Multipliers',
    upgrades: ['double', 'doublePro', 'doubleMax']
  },
  automation: {
    title: 'Auto Clickers',
    upgrades: ['autoClicker', 'autoClickerFast', 'autoClickerUltra']
  },
  special: {
    title: 'Special Abilities',
    upgrades: ['nuker']
  }
};

const Upgrades = ({ points, upgrades, ownedUpgrades, onPurchase, onClose, nukerCooldown, onNuker }) => {
  const getUpgradeData = (effectId) => 
    upgrades.find(upgrade => upgrade.effect === effectId);

  return (
    <div className="overlay">
      <div className="overlay-content">
        <h2>Upgrades Shop</h2>
        <button className="close-button" onClick={onClose}>×</button>
        
        <div className="points-display">
          Available Points: {points.toLocaleString()}
        </div>

        {Object.entries(upgradeCategories).map(([category, { title, upgrades: categoryUpgrades }]) => (
          <div key={category} className="upgrade-category">
            <h3>{title}</h3>
            <div className="upgrade-list">
              {categoryUpgrades.map(effectId => {
                const upgrade = getUpgradeData(effectId);
                const owned = ownedUpgrades.includes(effectId);
                const affordable = points >= upgrade.cost;
                const isNuker = effectId === 'nuker';

                return (
                  <div key={effectId} className="upgrade-item">
                    <div className="upgrade-info">
                      <div className="upgrade-name">{upgrade.name}</div>
                      <div className="upgrade-cost">{upgrade.cost.toLocaleString()} points</div>
                    </div>
                    {isNuker && owned ? (
                      <button
                        className="upgrade-button"
                        onClick={onNuker}
                        disabled={nukerCooldown}
                        style={{
                          backgroundColor: nukerCooldown ? '#555' : '#3B82F6'
                        }}
                      >
                        {nukerCooldown ? 'Cooldown' : 'Use Nuker'}
                      </button>
                    ) : (
                      <button
                        className="upgrade-button"
                        onClick={() => onPurchase(upgrade)}
                        disabled={owned || !affordable}
                        style={{
                          backgroundColor: owned ? '#059669' : affordable ? '#3B82F6' : '#555'
                        }}
                      >
                        {owned ? 'Owned' : affordable ? 'Buy' : 'Too Expensive'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Upgrades;
