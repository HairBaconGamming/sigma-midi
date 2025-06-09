// client/src/pages/MidiDetailPage.jsx
import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  getMidiById,
  trackMidiDownload,
  getMidiFileStreamUrl,
  deleteMidiById,
} from "../services/apiMidis";
import {
  FaDownload,
  FaPlayCircle,
  FaPauseCircle,
  FaUser,
  FaCalendarAlt,
  FaInfoCircle,
  FaTachometerAlt,
  FaMusic,
  FaEye,
  FaUserEdit,
  FaArrowLeft,
  FaTags,
  FaGuitar,
  FaStopwatch,
  FaStarHalfAlt,
  FaClipboardList,
  FaTrash,
} from "react-icons/fa";
import { Helmet } from "react-helmet-async";
import { usePlayer } from "../contexts/PlayerContext"; // Import the global player context
import { useAuth } from "../contexts/AuthContext";

import "../assets/css/MidiDetailPage.css";

// A clear and consistent date formatting utility.
const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  try {
    const options = {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  } catch (e) {
    console.warn("Error formatting date:", dateString, e);
    return "Invalid Date";
  }
};

// A clear and consistent time formatting utility.
const formatTime = (seconds) => {
  if (
    isNaN(seconds) ||
    seconds === null ||
    seconds === undefined ||
    seconds < 0
  )
    return "N/A";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}m ${s}s`;
};

const MidiDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  // Deconstructing the global PlayerContext to control the site-wide player.
  // This is a great example of centralizing complex state.
  const {
    playMidi,
    togglePlay,
    currentPlayingMidi,
    isPlaying: globalIsPlaying,
    isPianoSamplerReady,
    isLoadingPlayer: isGlobalPlayerLoading,
  } = usePlayer();

  const [midi, setMidi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // This effect is now solely responsible for fetching page-specific data,
  // which is a perfect separation of concerns.
  useEffect(() => {
    const fetchMidiDetails = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getMidiById(id);
        setMidi(res.data);
      } catch (err) {
        console.error(
          "Failed to fetch MIDI details for page",
          err.response ? err.response.data : err.message
        );
        if (err.response && err.response.status === 404) {
          setError("Sorry, this MIDI could not be found or is not public.");
        } else {
          setError(
            "An error occurred while loading MIDI details. Please try again later."
          );
        }
        setMidi(null);
      } finally {
        setLoading(false);
      }
    };
    fetchMidiDetails();
  }, [id]); // Correctly re-runs only when the page ID changes.

  const handleDownload = async () => {
    if (!midi || !midi.fileId) {
      alert("MIDI file information not available for download.");
      return;
    }
    try {
      await trackMidiDownload(midi._id);
      const downloadUrl = getMidiFileStreamUrl(midi.fileId);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute(
        "download",
        midi.original_filename || `midi_${midi._id}.mid`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setMidi((prev) =>
        prev ? { ...prev, downloads: (prev.downloads || 0) + 1 } : null
      );
    } catch (downloadError) {
      console.error(
        "Error tracking download or initiating download:",
        downloadError
      );
      alert("Could not initiate download. Please try again.");
    }
  };

  // This handler smartly interacts with the global player context.
  const handlePlayButtonClick = () => {
    if (!midi) return;

    // If this MIDI is already loaded in the global player, just toggle play/pause.
    if (currentPlayingMidi?._id === midi._id) {
      togglePlay();
    } else {
      // Otherwise, tell the global player to load and play this new MIDI.
      playMidi(midi);
    }
  };

  const handleDeleteFromDetailPage = async () => {
    if (!midi || !authUser || authUser.id !== midi.uploader?._id) {
      alert("You are not authorized to delete this MIDI.");
      return;
    }
    if (
      window.confirm(
        `Are you sure you want to delete "${midi.title}"? This action cannot be undone.`
      )
    ) {
      try {
        await deleteMidiById(midi._id);
        alert(`MIDI "${midi.title}" deleted successfully.`);
        navigate("/my-midis"); // Hoặc navigate('/')
      } catch (err) {
        console.error("Failed to delete MIDI from detail page", err);
        alert(
          `Could not delete MIDI: ${err.response?.data?.msg || err.message}`
        );
      }
    }
  };

  // State derived from the global context to control this page's UI.
  const isThisMidiActiveInGlobalPlayer = currentPlayingMidi?._id === midi?._id;
  const playButtonText =
    isThisMidiActiveInGlobalPlayer && globalIsPlaying
      ? "Pause in Bar"
      : "Play in Bar";
  const PlayButtonIcon =
    isThisMidiActiveInGlobalPlayer && globalIsPlaying
      ? FaPauseCircle
      : FaPlayCircle;

  // --- Meta Tags for SEO and Social Sharing (Excellent Addition) ---
  const pageTitle = midi
    ? `${midi.title} by ${midi.artist || "Unknown Artist"} - sigmaMIDI`
    : "MIDI Details - sigmaMIDI";
  const pageDescription = midi
    ? `Listen to, download, and explore the MIDI file "${midi.title}" by ${
        midi.artist || "Unknown Artist"
      }. Genre: ${midi.genre || "N/A"}. Uploaded by ${
        midi.uploader?.username || "User"
      }.`
    : "View details for this MIDI file on sigmaMIDI, the ultimate MIDI repository.";
  const pageUrl = window.location.href;
  const imageUrl =
    midi?.thumbnail_url ||
    (midi
      ? `/api/midis/placeholder-thumbnail/${
          parseInt(midi._id.slice(-5), 16) % 20
        }.png`
      : `https://midi-sigma.glitch.me/og-image.png`);

  if (loading) {
    return (
      <div className="loading-container-page">
        <div className="spinner-page"></div>
        <p>Loading MIDI Details...</p>
      </div>
    );
  }
  if (error)
    return <p className="alert-message alert-error container">{error}</p>;
  if (!midi)
    return (
      <p className="no-results-message-page container">
        MIDI not found or not accessible.
      </p>
    );

  const uploaderUsername = midi.uploader?.username || "Unknown User";
  const uploaderIdForLink = midi.uploader?._id;

  // Smartly choose the duration source: prefer the accurate, parsed duration from the
  // active player context, otherwise fall back to the DB value.
  const displayDuration = formatTime(
    isThisMidiActiveInGlobalPlayer
      ? currentPlayingMidi.duration
      : midi.duration_seconds
  );

  console.log("--- DEBUG DELETE BUTTON ---");
  console.log("authUser:", authUser);
  console.log("midi object:", midi);
  console.log("midi.uploader:", midi?.uploader); // Dùng optional chaining

  if (authUser) {
    console.log("authUser.id:", authUser.id, "(type:", typeof authUser.id, ")");
  } else {
    console.log("authUser is null or undefined");
  }

  if (midi && midi.uploader) {
    console.log(
      "midi.uploader._id:",
      midi.uploader._id,
      "(type:",
      typeof midi.uploader._id,
      ")"
    );
    if (authUser) {
      const idsMatch = authUser.id === midi.uploader._id;
      console.log(`IDs match (authUser.id === midi.uploader._id): ${idsMatch}`);
      if (!idsMatch) {
        console.error(
          "IDs DO NOT MATCH! authUser.id:",
          authUser.id,
          "midi.uploader._id:",
          midi.uploader._id
        );
      }
    }
  } else {
    console.log("midi or midi.uploader is null or undefined");
  }
  console.log("--- END DEBUG DELETE BUTTON ---");

  return (
    <>
      {/* Dynamic head management for SEO is a professional feature. */}
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="title" content={pageTitle} />
        <meta name="description" content={pageDescription} />
        <link rel="canonical" href={pageUrl} />

        {/* Open Graph / Facebook tags */}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={pageUrl} />
        {/* Using `new URL()` ensures the image URL is absolute, which is required. */}
        <meta
          property="og:image"
          content={new URL(imageUrl, window.location.origin).href}
        />
        <meta property="og:type" content="music.song" />
        <meta property="og:site_name" content="sigmaMIDI" />
        {midi.artist && (
          <meta property="music:musician" content={midi.artist} />
        )}

        {/* Twitter tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta
          name="twitter:image"
          content={new URL(imageUrl, window.location.origin).href}
        />
      </Helmet>

      <div className="midi-detail-page-container container">
        <button
          onClick={() => navigate(-1)}
          className="back-button"
          title="Go back to previous page"
        >
          <FaArrowLeft /> Back
        </button>

        <article className="midi-detail-content-card">
          <header className="midi-detail-header">
            <div className="header-thumbnail-container">
              <img
                src={
                  midi.thumbnail_url ||
                  `/api/midis/placeholder-thumbnail/${
                    parseInt(midi._id.slice(-5), 16) % 20
                  }.png`
                }
                alt={`${midi.title} thumbnail`}
                className="header-thumbnail"
              />
            </div>
            <div className="header-info">
              <h1>{midi.title}</h1>
              <p className="header-artist">
                <FaMusic className="icon" /> By:{" "}
                {midi.artist || "Unknown Artist"}
              </p>
              {midi.arrangement_by && (
                <p className="header-arrangement">
                  <FaUserEdit className="icon" /> Arrangement:{" "}
                  {midi.arrangement_by}
                </p>
              )}
              <div className="header-meta">
                <span>
                  <FaUser className="icon" /> Uploaded by:
                  {/* Safely render a Link only if the uploader ID exists. */}
                  {uploaderIdForLink ? (
                    <Link
                      to={`/profile/${uploaderIdForLink}`}
                      className="uploader-link"
                    >
                      {uploaderUsername}
                    </Link>
                  ) : (
                    <span className="uploader-link">{uploaderUsername}</span>
                  )}
                </span>
                <span>
                  <FaCalendarAlt className="icon" /> On:{" "}
                  {formatDate(midi.upload_date)}
                </span>
                {/* A robust way to check if the updated date is different from the upload date. */}
                {midi.last_updated_date &&
                  new Date(midi.last_updated_date).toISOString() !==
                    new Date(midi.upload_date).toISOString() && (
                    <span>
                      <FaCalendarAlt className="icon" /> Updated:{" "}
                      {formatDate(midi.last_updated_date)}
                    </span>
                  )}
              </div>
            </div>
          </header>

          <div className="midi-detail-actions-bar">
            <button
              onClick={handlePlayButtonClick}
              className={`btn-detail-action btn-play-detail ${
                isThisMidiActiveInGlobalPlayer && globalIsPlaying
                  ? "playing"
                  : ""
              }`}
              // This disabled logic is very robust, preventing actions during loading states.
              disabled={
                !isPianoSamplerReady || isGlobalPlayerLoading || !midi.fileId
              }
              title={playButtonText}
            >
              <PlayButtonIcon className="icon" /> {playButtonText}
            </button>
            {authUser && midi.uploader && authUser.id === midi.uploader._id && (
              <button
                onClick={handleDeleteFromDetailPage}
                className="btn-detail-action btn-delete-detail-page" /* Tạo style riêng nếu cần */
                title="Delete this MIDI"
              >
                <FaTrash className="icon" /> Delete MIDI
              </button>
            )}
            <button
              onClick={handleDownload}
              className="btn-detail-action btn-download-detail"
              disabled={!midi.fileId}
            >
              <FaDownload className="icon" /> Download (
              {midi.size_bytes
                ? `${(midi.size_bytes / 1024).toFixed(1)} KB`
                : "N/A"}
              )
            </button>
            <div className="detail-stats">
              <span>
                <FaEye className="icon" /> {midi.views || 0}
              </span>
              <span>
                <FaDownload className="icon" /> {midi.downloads || 0}
              </span>
            </div>
          </div>

          {midi.description && (
            <section className="midi-detail-section description-section">
              <h3>
                <FaInfoCircle className="icon" /> Description
              </h3>
              <p className="description-text">{midi.description}</p>
            </section>
          )}

          <section className="midi-detail-section metadata-section">
            <h3>
              <FaClipboardList className="icon" /> Details & Metadata
            </h3>
            <ul>
              <li>
                <strong>Original Filename:</strong>{" "}
                {midi.original_filename || "N/A"}
              </li>
              {midi.genre && (
                <li>
                  <strong>
                    <FaTags className="icon" /> Genre:
                  </strong>{" "}
                  {midi.genre}
                </li>
              )}
              {midi.tags && midi.tags.length > 0 && (
                <li>
                  <strong>
                    <FaTags className="icon" /> Tags:
                  </strong>
                  <span className="tags-list">
                    {midi.tags.map((tag) => (
                      <span key={tag} className="tag-item">
                        {tag}
                      </span>
                    ))}
                  </span>
                </li>
              )}
              {midi.bpm && (
                <li>
                  <strong>
                    <FaTachometerAlt className="icon" /> BPM (Tempo):
                  </strong>{" "}
                  {midi.bpm}
                </li>
              )}
              <li>
                <strong>
                  <FaStopwatch className="icon" /> Duration:
                </strong>{" "}
                {displayDuration}
              </li>
              {midi.key_signature && (
                <li>
                  <strong>Key:</strong> {midi.key_signature}
                </li>
              )}
              {midi.time_signature && (
                <li>
                  <strong>Time Signature:</strong> {midi.time_signature}
                </li>
              )}
              {midi.instrumentation && (
                <li>
                  <strong>
                    <FaGuitar className="icon" /> Instrumentation:
                  </strong>{" "}
                  {midi.instrumentation}
                </li>
              )}
              {midi.difficulty && (
                <li>
                  <strong>
                    <FaStarHalfAlt className="icon" /> Difficulty:
                  </strong>
                  <span
                    className={`difficulty-level difficulty-${midi.difficulty}`}
                  >
                    {midi.difficulty}/5
                  </span>
                </li>
              )}
            </ul>
          </section>
        </article>
      </div>
    </>
  );
};

export default MidiDetailPage;
