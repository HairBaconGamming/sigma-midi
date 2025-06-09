// client/src/components/layout/MiniPlayerBar.jsx
import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "../../contexts/PlayerContext";
import {
  FaPlay,
  FaPause,
  FaVolumeUp,
  FaVolumeMute,
  FaVolumeDown,
  FaTimes,
  FaCog,
  FaSyncAlt,
  FaStepForward, // Icons for settings, loop, autoplay
  FaSync,
} from "react-icons/fa";
import "../../assets/css/MiniPlayerBar.css";

const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
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

    isLooping,
    setIsLooping,
    isAutoplayNext,
    setIsAutoplayNext,
    volume,
    setVolume, // Direct setVolume from context (which is handleSetVolume)
    isMuted,
    toggleMute, // Direct toggleMute from context (which is toggleMuteOnly)

    togglePlay,
    seekPlayer,
    clearAndClosePlayer,
  } = usePlayer();

  const [showSettings, setShowSettings] = useState(false);
  const settingsButtonRef = useRef(null);
  const settingsDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        settingsDropdownRef.current &&
        !settingsDropdownRef.current.contains(event.target) &&
        settingsButtonRef.current &&
        !settingsButtonRef.current.contains(event.target)
      ) {
        setShowSettings(false);
      }
    };
    if (showSettings) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSettings]);

  if (!currentPlayingMidi && !isLoadingPlayer) {
    return null;
  }

  const handleProgressClick = (e) => {
    if (!currentPlayingMidi || durationTotal <= 0) return;
    const progressBar = e.currentTarget;
    const clickPosition = e.nativeEvent.offsetX / progressBar.offsetWidth;
    seekPlayer(clickPosition * durationTotal);
  };

  const progressPercent =
    durationTotal > 0 ? (playbackTime / durationTotal) * 100 : 0;

  const VolumeIcon = isMuted
    ? FaVolumeMute
    : volume <= 0.01
    ? FaVolumeMute
    : volume < 0.5
    ? FaVolumeDown
    : FaVolumeUp;

  return (
    <div className={`mini-player-bar ${currentPlayingMidi ? "visible" : ""}`}>
      {isLoadingPlayer && (
        <div className="player-loading-indicator">Loading Player...</div>
      )}
      {playerError && !isLoadingPlayer && (
        <div className="player-error-indicator">
          Error: {playerError}
          <button
            onClick={clearAndClosePlayer}
            className="player-close-btn-error"
            title="Clear Error"
          >
            <FaTimes />
          </button>
        </div>
      )}

      {currentPlayingMidi && !isLoadingPlayer && !playerError && (
        <>
          <div className="mini-player-track-info">
            <div className="mini-player-text">
              <Link
                to={`/midi/${currentPlayingMidi._id}`}
                className="track-title"
                title={currentPlayingMidi.title}
              >
                {currentPlayingMidi.title}
              </Link>
              <span className="track-artist">
                {currentPlayingMidi.artist || "Unknown Artist"}
              </span>
            </div>
          </div>

          <div className="mini-player-controls-main">
            <button
              onClick={togglePlay}
              className="control-btn play-pause-btn"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <FaPause size={20} /> : <FaPlay size={20} />}
            </button>
          </div>

          <div className="mini-player-progress-section">
            <span className="time-current">{formatTime(playbackTime)}</span>
            <div
              className="progress-bar-container-mini"
              onClick={handleProgressClick}
            >
              <div
                className="progress-bar-mini"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <span className="time-duration">{formatTime(durationTotal)}</span>
          </div>

          <div className="mini-player-actions-extra">
            <div className="volume-control-container">
              <button
                onClick={toggleMute}
                className="control-btn volume-icon-btn"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                <VolumeIcon />
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="volume-slider"
                aria-label="Volume"
              />
            </div>

            <div className="settings-container">
              <button
                ref={settingsButtonRef}
                onClick={() => setShowSettings(!showSettings)}
                className={`control-btn settings-btn ${
                  showSettings ? "active" : ""
                }`}
                title="Player Settings"
                aria-haspopup="true"
                aria-expanded={showSettings}
              >
                <FaCog />
              </button>
              {showSettings && (
                <div ref={settingsDropdownRef} className="settings-dropdown">
                  <label>
                    <span className="label-text">
                      <FaSync /> {/* Or your icon */}
                      Loop
                    </span>
                    <input
                      type="checkbox"
                      checked={isLooping}
                      onChange={(e) => setIsLooping(e.target.checked)}
                    />
                    <span className="toggle-switch"></span>
                  </label>

                  <label>
                    <span className="label-text">
                      <FaStepForward /> {/* Or your icon */}
                      Autoplay
                    </span>
                    <input
                      type="checkbox"
                      checked={isAutoplayNext}
                      onChange={(e) => setIsAutoplayNext(e.target.checked)}
                    />
                    <span className="toggle-switch"></span>
                  </label>
                </div>
              )}
            </div>

            <button
              onClick={clearAndClosePlayer}
              className="control-btn close-player-btn"
              title="Close Player"
            >
              <FaTimes />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default React.memo(MiniPlayerBar); // Memoize for performance
