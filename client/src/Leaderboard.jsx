import React, { useEffect, useState } from 'react';
import './Leaderboard.css';

const Leaderboard = ({ socket, onClose }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (socket) {
      setIsLoading(true);
      socket.emit('requestLeaderboard');
      
      const handleLeaderboardUpdate = (data) => {
        setLeaderboard(data);
        setIsLoading(false);
      };

      socket.on('leaderboardUpdate', handleLeaderboardUpdate);
      
      return () => {
        socket.off('leaderboardUpdate', handleLeaderboardUpdate);
      };
    }
  }, [socket]);

  return (
    <div className="overlay">
      <div className="overlay-content">
        <h2>Leaderboard</h2>
        <button className="close-button" onClick={onClose}>X</button>
        {isLoading ? (
          <div className="loading">Loading...</div>
        ) : leaderboard.length === 0 ? (
          <div className="no-data">No scores yet!</div>
        ) : (
          <div className="leaderboard-list">
            {leaderboard.map((player, index) => (
              <div key={player.id} className="leaderboard-item">
                <span className="rank">#{index + 1}</span>
                <span className="username">{player.username || 'Anonymous'}</span>
                <span className="points">{player.points} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;