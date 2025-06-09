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
  const volumeNodeRef = useRef(null);
  const parsedMidiFileRef = useRef(null);
  const animationFrameRef = useRef(null);

  // --- Core Setup and Cleanup ---

  useEffect(() => {
    if (!pianoRef.current) {
      console.log("Global Player: Initializing Piano and Volume Node...");
      setIsLoadingPlayer(true);
      volumeNodeRef.current = new Tone.Volume(Tone.gainToDb(0.8)).toDestination();
      const piano = new Piano({ velocities: 4, release: true });
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
      pianoRef.current?.dispose();
      volumeNodeRef.current?.dispose();
      Tone.Transport.stop();
      Tone.Transport.cancel();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // --- Volume/Mute Effect ---
  useEffect(() => {
    if (volumeNodeRef.current) {
      volumeNodeRef.current.mute = isMuted;
      if (!isMuted) {
        volumeNodeRef.current.volume.value = Tone.gainToDb(volume);
      }
    }
  }, [volume, isMuted]);

  // --- Seamless Looping Logic ---
  useEffect(() => {
    Tone.Transport.loop = isLooping;
    if (isLooping && durationTotal > 0) {
      Tone.Transport.loopStart = 0;
      Tone.Transport.loopEnd = durationTotal;
    }
  }, [isLooping, durationTotal]);


  // --- Core Player Functions ---

  const stopCurrentTrackAudio = useCallback((resetTime = true) => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setIsPlaying(false);
    if (resetTime) {
      setPlaybackTime(0);
      Tone.Transport.seconds = 0;
    }
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

      if (scheduleNotes()) {
        Tone.Transport.start();
        setIsPlaying(true);
      } else {
        throw new Error("Could not schedule MIDI notes.");
      }
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
        stopCurrentTrackAudio(true);
      }
    } catch (error) {
      console.error("Global Player: Error fetching next MIDI for autoplay:", error);
      stopCurrentTrackAudio(true);
    }
  }, [currentPlayingMidi, playMidi, stopCurrentTrackAudio]);

  const updateProgressLoop = useCallback(() => {
    const currentTime = Tone.Transport.seconds;
    setPlaybackTime(currentTime);

    if (!isLooping && durationTotal > 0 && currentTime >= durationTotal - 0.1) {
      if (isAutoplayNext) {
        playNextMidi();
      } else {
        stopCurrentTrackAudio(true);
        scheduleNotes();
      }
    } else {
      animationFrameRef.current = requestAnimationFrame(updateProgressLoop);
    }
  }, [durationTotal, isLooping, isAutoplayNext, playNextMidi, stopCurrentTrackAudio, scheduleNotes]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgressLoop);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, updateProgressLoop]);

  // --- FIX: REORDERED FUNCTIONS ---
  // `seekPlayer` is now defined BEFORE `togglePlay`, which depends on it.

  const seekPlayer = useCallback(async (time) => {
    if (!currentPlayingMidi || !isMidiDataLoaded || durationTotal <= 0) return;
    if (!await startToneAudioContext()) return;

    const wasPlaying = isPlaying;
    Tone.Transport.stop();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setIsPlaying(false);

    const newTime = Math.max(0, Math.min(time, durationTotal));
    setPlaybackTime(newTime);
    Tone.Transport.seconds = newTime;
    
    scheduleNotes();

    if (wasPlaying) {
      Tone.Transport.start();
      setIsPlaying(true);
    }
  }, [currentPlayingMidi, isMidiDataLoaded, durationTotal, isPlaying, scheduleNotes]);

  const togglePlay = useCallback(async () => {
    if (!currentPlayingMidi || !isMidiDataLoaded) return;
    if (!await startToneAudioContext()) return;
    
    if (isPlaying) {
      Tone.Transport.pause();
      setIsPlaying(false);
    } else {
      if (playbackTime >= durationTotal - 0.1 && durationTotal > 0) {
        // Now this call is safe because seekPlayer is already defined.
        await seekPlayer(0); 
      }
      Tone.Transport.start();
      setIsPlaying(true);
    }
  }, [currentPlayingMidi, isMidiDataLoaded, isPlaying, playbackTime, durationTotal, seekPlayer]);

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