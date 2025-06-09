// client/src/components/layout/MiniPlayerBar.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../../contexts/PlayerContext';
import { FaPlay, FaPause, FaStepForward, FaStepBackward, FaVolumeUp, FaVolumeMute, FaTimes } from 'react-icons/fa'; // Using FaPlay for play icon
import '../../assets/css/MiniPlayerBar.css'; // Create this CSS file

const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

const MiniPlayerBar = () => {
  const {
    currentPlayingMidi,
    isPlaying,
    playbackTime,
    durationTotal,
    isLoadingPlayer,
    playerError,
    isMuted,
    togglePlay,
    seekPlayer,
    togglePlayerMute,
    stopPlayer, // To close/clear the player
  } = usePlayer();

  if (!currentPlayingMidi && !isLoadingPlayer) {
    return null; // Don't render if nothing is selected or loading
  }

  const handleProgressClick = (e) => {
    if (!currentPlayingMidi || durationTotal <= 0) return;
    const progressBar = e.currentTarget;
    const clickPosition = (e.nativeEvent.offsetX / progressBar.offsetWidth);
    seekPlayer(clickPosition * durationTotal);
  };

  const progressPercent = durationTotal > 0 ? (playbackTime / durationTotal) * 100 : 0;

  return (
    <div className={`mini-player-bar ${currentPlayingMidi ? 'visible' : ''}`}>
      {isLoadingPlayer && (
        <div className="player-loading-indicator">Loading Player...</div>
      )}
      {playerError && !isLoadingPlayer && (
        <div className="player-error-indicator">Error: {playerError} 
            <button onClick={stopPlayer} className="player-close-btn-error" title="Clear Error"><FaTimes/></button>
        </div>
      )}

      {currentPlayingMidi && !isLoadingPlayer && !playerError && (
        <>
          <div className="mini-player-track-info">
            {/* Add thumbnail later if desired */}
            <div className="mini-player-text">
              <Link to={`/midi/${currentPlayingMidi._id}`} className="track-title" title={currentPlayingMidi.title}>
                {currentPlayingMidi.title}
              </Link>
              <span className="track-artist">{currentPlayingMidi.artist || 'Unknown Artist'}</span>
            </div>
          </div>

          <div className="mini-player-controls-main">
            {/* <button className="control-btn"><FaStepBackward /></button> */}
            <button onClick={togglePlay} className="control-btn play-pause-btn" aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <FaPause size={20} /> : <FaPlay size={20} />}
            </button>
            {/* <button className="control-btn"><FaStepForward /></button> */}
          </div>
          
          <div className="mini-player-progress-section">
            <span className="time-current">{formatTime(playbackTime)}</span>
            <div className="progress-bar-container-mini" onClick={handleProgressClick}>
              <div className="progress-bar-mini" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <span className="time-duration">{formatTime(durationTotal)}</span>
          </div>

          <div className="mini-player-actions-extra">
            <button onClick={togglePlayerMute} className="control-btn volume-btn" aria-label={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
            </button>
            <button onClick={() => stopPlayer()} className="control-btn close-player-btn" title="Close Player">
                <FaTimes />
            </button>
            {/* Add other controls like queue, shuffle, repeat here if needed */}
          </div>
        </>
      )}
    </div>
  );
};

export default MiniPlayerBar;