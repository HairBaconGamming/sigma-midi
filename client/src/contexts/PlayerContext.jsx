// client/src/contexts/PlayerContext.jsx
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
import { Midi as ToneMidi } from '@tonejs/midi';
import { Piano } from '@tonejs/piano';
import { getMidiFileStreamUrl, getRandomMidi } from '../services/apiMidis';

const PlayerContext = createContext();

export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider = ({ children }) => {
  // Core State
  const [currentPlayingMidi, setCurrentPlayingMidi] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [durationTotal, setDurationTotal] = useState(0);
  const [isLoadingPlayer, setIsLoadingPlayer] = useState(false);
  const [playerError, setPlayerError] = useState('');
  const [isMidiDataLoaded, setIsMidiDataLoaded] = useState(false);
  const [isPianoSamplerReady, setIsPianoSamplerReady] = useState(false);

  // Feature State
  const [isLooping, setIsLooping] = useState(false);
  const [isAutoplayNext, setIsAutoplayNext] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  // Refs for Tone.js and animation
  const pianoRef = useRef(null);
  // --- FIX: Create a dedicated ref for our volume control node ---
  const volumeNodeRef = useRef(null);
  const parsedMidiFileRef = useRef(null);
  const animationFrameRef = useRef(null);

  // --- Core Setup and Cleanup ---

  useEffect(() => {
    // This effect runs only once on mount to initialize the piano and volume node.
    if (!pianoRef.current) {
      console.log("Global Player: Initializing Piano and Volume Node...");
      setIsLoadingPlayer(true);

      // --- FIX: Create our own volume node ---
      // Set its initial volume and connect it to the master output (speakers).
      volumeNodeRef.current = new Tone.Volume(Tone.gainToDb(0.8)).toDestination();

      // Create the piano instance.
      const piano = new Piano({ velocities: 4, release: true });
      
      // --- FIX: Connect the piano to OUR volume node, NOT the destination directly ---
      piano.connect(volumeNodeRef.current);

      pianoRef.current = piano;

      piano.load()
        .then(() => {
          console.log("Global Player: Piano samples loaded.");
          setIsPianoSamplerReady(true);
        })
        .catch(err => {
          console.error("Global Player: Failed to load piano samples:", err);
          setPlayerError("Could not load piano sound. " + (err.message || ""));
        })
        .finally(() => {
            setIsLoadingPlayer(false);
        });
    }

    return () => {
      // Cleanup all created Tone.js nodes on unmount.
      pianoRef.current?.dispose();
      volumeNodeRef.current?.dispose(); // <-- FIX: Dispose our volume node too
      Tone.Transport.stop();
      Tone.Transport.cancel();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []); // Empty dependency array ensures this runs only once.

  // --- CORRECTED VOLUME/MUTE EFFECT ---
  useEffect(() => {
    // This effect now reliably controls our dedicated volume node.
    if (volumeNodeRef.current) {
      volumeNodeRef.current.mute = isMuted;

      // Only adjust the volume if not muted.
      if (!isMuted) {
        // The property path for a Tone.Volume node's volume is `.volume.value`
        volumeNodeRef.current.volume.value = Tone.gainToDb(volume);
      }
    }
    // This effect should only depend on the state values it controls.
  }, [volume, isMuted]);


  // --- All other functions remain the same as they were correct ---

  const stopCurrentTrackAudio = useCallback((resetTime = true) => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setIsPlaying(false);
    if (resetTime) setPlaybackTime(0);
  }, []);

  const clearAndClosePlayer = useCallback(() => {
    stopCurrentTrackAudio(true);
    setCurrentPlayingMidi(null);
    parsedMidiFileRef.current = null;
    setIsMidiDataLoaded(false);
    setDurationTotal(0);
    setPlayerError('');
  }, [stopCurrentTrackAudio]);

  const scheduleNotes = useCallback(() => {
    if (!parsedMidiFileRef.current || !pianoRef.current) return false;
    Tone.Transport.cancel();
    parsedMidiFileRef.current.tracks.forEach(track => {
      track.notes.forEach(note => {
        Tone.Transport.schedule(time => {
          pianoRef.current?.keyDown({ note: note.name, time, velocity: note.velocity });
          pianoRef.current?.keyUp({ note: note.name, time: time + note.duration });
        }, note.time);
      });
    });
    return true;
  }, []);
  
  const startToneAudioContext = async () => {
    if (Tone.context.state !== 'running') {
      try { await Tone.start(); return true; } catch (e) {
        setPlayerError("Audio context error. Click a player button to start."); return false;
      }
    }
    return true;
  };
  
  const playMidi = useCallback(async (midiData) => {
    if (!midiData?.fileId) { setPlayerError("Invalid MIDI data provided."); return; }
    if (!isPianoSamplerReady) { setPlayerError("Piano sound is not ready yet."); return; }
    if (!await startToneAudioContext()) return;
  
    stopCurrentTrackAudio(true);
    setIsLoadingPlayer(true);
    setPlayerError('');
  
    try {
      const midiUrl = getMidiFileStreamUrl(midiData.fileId);
      const parsedMidi = await ToneMidi.fromUrl(midiUrl);
  
      parsedMidiFileRef.current = parsedMidi;
      setCurrentPlayingMidi(midiData);
      setDurationTotal(parsedMidi.duration);
      setIsMidiDataLoaded(true);
  
      Tone.Transport.seconds = 0;
      if (scheduleNotes()) {
        Tone.Transport.start(); setIsPlaying(true);
      } else { throw new Error("Could not schedule MIDI notes."); }
    } catch (e) {
      console.error("Global Player: Error in playMidi execution:", e);
      setPlayerError(`Failed to play MIDI: ${e.message}`);
      clearAndClosePlayer();
    } finally {
      setIsLoadingPlayer(false);
    }
  }, [isPianoSamplerReady, stopCurrentTrackAudio, scheduleNotes, clearAndClosePlayer]);

  const playNextMidi = useCallback(async () => {
    try {
        const nextMidi = await getRandomMidi(currentPlayingMidi?._id);
        if (nextMidi) {
            await playMidi(nextMidi);
        } else {
            setIsPlaying(false);
        }
    } catch (error) {
        console.error("Global Player: Error fetching next MIDI for autoplay:", error);
        setIsPlaying(false);
    }
  }, [currentPlayingMidi, playMidi]);

  const updateProgressLoop = useCallback(() => {
    const currentTime = Tone.Transport.seconds;
    setPlaybackTime(currentTime);

    if (currentTime >= durationTotal - 0.05 && durationTotal > 0) {
      stopCurrentTrackAudio(true);
      if (isLooping) {
        if (scheduleNotes()) { Tone.Transport.start(); setIsPlaying(true); }
      } else if (isAutoplayNext) {
        playNextMidi();
      } else {
        scheduleNotes();
      }
    } else {
      animationFrameRef.current = requestAnimationFrame(updateProgressLoop);
    }
  }, [durationTotal, isLooping, isAutoplayNext, stopCurrentTrackAudio, scheduleNotes, playNextMidi]);

  useEffect(() => {
    if (isPlaying) { animationFrameRef.current = requestAnimationFrame(updateProgressLoop); }
    else if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); }
  }, [isPlaying, updateProgressLoop]);

  const togglePlay = useCallback(async () => {
    if (!currentPlayingMidi || !isMidiDataLoaded) return;
    if (!await startToneAudioContext()) return;
    
    if (isPlaying) { Tone.Transport.pause(); setIsPlaying(false); }
    else { Tone.Transport.start(); setIsPlaying(true); }
  }, [currentPlayingMidi, isMidiDataLoaded, isPlaying]);

  const seekPlayer = useCallback(async (time) => {
    if (!currentPlayingMidi || !isMidiDataLoaded || durationTotal <= 0) return;
    if (!await startToneAudioContext()) return;
    
    const wasPlaying = isPlaying;
    stopCurrentTrackAudio(false);
    
    const newTime = Math.max(0, Math.min(time, durationTotal));
    setPlaybackTime(newTime);
    Tone.Transport.seconds = newTime;
    
    scheduleNotes();

    if (wasPlaying) { Tone.Transport.start(); setIsPlaying(true); }
  }, [currentPlayingMidi, isMidiDataLoaded, durationTotal, isPlaying, stopCurrentTrackAudio, scheduleNotes]);

  const handleSetVolume = useCallback((newVolume) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
    if (clampedVolume > 0 && isMuted) { setIsMuted(false); }
  }, [isMuted]);

  const toggleMute = useCallback(() => { setIsMuted(prev => !prev); }, []);

  const value = {
    currentPlayingMidi, isPlaying, playbackTime, durationTotal, isMidiDataLoaded,
    isPianoSamplerReady, isLoadingPlayer, playerError,
    isLooping, isAutoplayNext, volume, isMuted,
    playMidi, togglePlay, seekPlayer, stopCurrentTrackAudio,
    clearAndClosePlayer, setIsLooping, setIsAutoplayNext,
    setVolume: handleSetVolume, toggleMute,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};