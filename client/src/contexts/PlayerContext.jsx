// client/src/contexts/PlayerContext.jsx
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
import { Midi as ToneMidi } from '@tonejs/midi';
import { Piano } from '@tonejs/piano';
import { getMidiFileStreamUrl } from '../services/apiMidis';

const PlayerContext = createContext();

export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider = ({ children }) => {
  const [currentPlayingMidi, setCurrentPlayingMidi] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [durationTotal, setDurationTotal] = useState(0);
  const [isMidiDataLoaded, setIsMidiDataLoaded] = useState(false);
  const [isPianoSamplerReady, setIsPianoSamplerReady] = useState(false);
  const [isLoadingPlayer, setIsLoadingPlayer] = useState(false);
  const [playerError, setPlayerError] = useState('');
  const [isMuted, setIsMuted] = useState(false);

  const pianoRef = useRef(null);
  const parsedMidiFileRef = useRef(null);
  const scheduledEventsRef = useRef([]);
  const animationFrameRef = useRef(null);
  const toneContextStarted = useRef(false);

  useEffect(() => {
    if (!pianoRef.current && !isPianoSamplerReady) {
      console.log("Global Player: Initializing Piano...");
      setIsLoadingPlayer(true);
      const piano = new Piano({ velocities: 4, release: true });
      piano.toDestination();
      pianoRef.current = piano;
      piano.load()
        .then(() => {
          setIsPianoSamplerReady(true);
          setIsLoadingPlayer(false);
          console.log("Global Player: Piano samples loaded.");
        })
        .catch(err => {
          console.error("Global Player: Failed to load piano samples:", err);
          setPlayerError("Could not load piano sound for global player.");
          setIsPianoSamplerReady(false);
          setIsLoadingPlayer(false);
          pianoRef.current = null;
        });
    }
  }, [isPianoSamplerReady]);

  const stopCurrentTrackAudio = useCallback(() => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
    scheduledEventsRef.current = [];
    if (pianoRef.current && isPianoSamplerReady) {
      for (let i = 21; i <= 108; i++) pianoRef.current.keyUp({ midi: i, time: Tone.now() });
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setIsPlaying(false);
    setPlaybackTime(0);
    // Note: currentPlayingMidi is NOT reset here.
  }, [isPianoSamplerReady]);

  const clearAndClosePlayer = useCallback(() => {
    stopCurrentTrackAudio(); // Stop audio and reset playback time
    setCurrentPlayingMidi(null); // Clear the currently playing MIDI info
    parsedMidiFileRef.current = null; // Clear parsed MIDI data
    setIsMidiDataLoaded(false); // Reset MIDI loaded flag
    setDurationTotal(0); // Reset duration
    setPlayerError(''); // Clear any errors
    // isPlaying should already be false from stopCurrentTrackAudio
  }, [stopCurrentTrackAudio]);


  const loadAndParseMidi = useCallback(async (midiToLoad) => {
    if (!midiToLoad || !midiToLoad.fileId) {
      setPlayerError("No file ID provided for playback.");
      return false;
    }
    if (!isPianoSamplerReady || !pianoRef.current) {
      setPlayerError("Piano sound not ready.");
      return false;
    }

    stopCurrentTrackAudio(); // Clean up before loading new
    setIsLoadingPlayer(true);
    setPlayerError('');
    setIsMidiDataLoaded(false);
    parsedMidiFileRef.current = null;

    try {
      const midiUrl = getMidiFileStreamUrl(midiToLoad.fileId);
      const parsed = await ToneMidi.fromUrl(midiUrl);
      parsedMidiFileRef.current = parsed;
      setDurationTotal(parsed.duration);
      setCurrentPlayingMidi(midiToLoad);
      setIsMidiDataLoaded(true);
      console.log("Global Player: MIDI parsed:", parsed.name);
      return true;
    } catch (e) {
      console.error("Global Player: Error loading/parsing MIDI:", e);
      setPlayerError(`Could not load MIDI: ${e.message}`);
      setCurrentPlayingMidi(null);
      return false;
    } finally {
      setIsLoadingPlayer(false);
    }
  }, [isPianoSamplerReady, stopCurrentTrackAudio]);

  const scheduleNotesForGlobalPlayer = useCallback(() => {
    if (!parsedMidiFileRef.current || !pianoRef.current || !isPianoSamplerReady) return false;
    
    scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
    scheduledEventsRef.current = [];
    Tone.Transport.cancel(); // Ensure transport is clear before scheduling

    parsedMidiFileRef.current.tracks.forEach(track => {
      track.notes.forEach(note => {
        const eventId = Tone.Transport.schedule(time => {
          if (pianoRef.current && isPianoSamplerReady) {
            pianoRef.current.keyDown({ note: note.name, time, velocity: note.velocity });
            pianoRef.current.keyUp({ note: note.name, time: time + note.duration });
          }
        }, note.time);
        scheduledEventsRef.current.push(eventId);
      });
    });
    console.log("Global Player: Notes scheduled.");
    return true;
  }, [isPianoSamplerReady]);

  const startToneAudioContext = async () => {
    if (Tone.context.state !== 'running') {
      try {
        await Tone.start();
        toneContextStarted.current = true;
        console.log("Global Player: Tone AudioContext started.");
        return true;
      } catch (e) {
        setPlayerError("Audio context error. Please interact with the page.");
        console.error("Global Player: Error starting Tone AudioContext:", e);
        return false;
      }
    }
    return true;
  };

  const updateProgressLoop = useCallback(() => {
    if (Tone.Transport.state === "started" && parsedMidiFileRef.current) {
      const currentTime = Tone.Transport.seconds;
      setPlaybackTime(currentTime);
      if (currentTime >= durationTotal - 0.05 && durationTotal > 0) {
        console.log("Global Player: MIDI end.");
        Tone.Transport.stop();
        setIsPlaying(false);
        setPlaybackTime(0); 
        Tone.Transport.seconds = 0;
        if (parsedMidiFileRef.current) scheduleNotesForGlobalPlayer();
      } else {
        animationFrameRef.current = requestAnimationFrame(updateProgressLoop);
      }
    }
  }, [durationTotal, scheduleNotesForGlobalPlayer]);

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateProgressLoop);
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, updateProgressLoop]);

  const togglePlayControls = useCallback(async (forcePlay) => {
    if (!currentPlayingMidi || !isMidiDataLoaded || !isPianoSamplerReady || !pianoRef.current) {
      setPlayerError("Cannot play: Player not fully ready.");
      return;
    }
    const audioContextNowReady = await startToneAudioContext();
    if (!audioContextNowReady) return;

    const currentTransportState = Tone.Transport.state;

    if (currentTransportState === "started" && forcePlay !== true) {
      Tone.Transport.pause();
      setIsPlaying(false);
    } else {
      if (currentTransportState === "stopped" || scheduledEventsRef.current.length === 0) {
        Tone.Transport.seconds = playbackTime;
        if (!scheduleNotesForGlobalPlayer()) {
            setPlayerError("Failed to schedule notes.");
            return;
        }
      }
      Tone.Transport.start();
      setIsPlaying(true);
    }
  }, [currentPlayingMidi, isMidiDataLoaded, isPianoSamplerReady, playbackTime, scheduleNotesForGlobalPlayer]);

  const playMidi = useCallback(async (midiData) => {
    if (!midiData || !midiData.fileId) {
        console.error("Global Player: playMidi called with invalid midiData", midiData);
        setPlayerError("Invalid MIDI data to play.");
        return;
    }
    if (!isPianoSamplerReady) {
        setPlayerError("Piano sound is not ready yet. Please wait.");
        return;
    }

    console.log("Global Player: playMidi called for", midiData.title);
    const audioContextNowReady = await startToneAudioContext();
    if (!audioContextNowReady) return;

    if (!currentPlayingMidi || currentPlayingMidi._id !== midiData._id || !isMidiDataLoaded) {
        const loaded = await loadAndParseMidi(midiData);
        if (!loaded) return;
    }
    
    setPlaybackTime(0); 
    Tone.Transport.seconds = 0;
    
    togglePlayControls(true); // Force play

  }, [isPianoSamplerReady, currentPlayingMidi, isMidiDataLoaded, loadAndParseMidi, togglePlayControls]);

  const seekPlayer = useCallback(async (time) => {
    if (!currentPlayingMidi || !isMidiDataLoaded || !parsedMidiFileRef.current || !isPianoSamplerReady || durationTotal <= 0) return;
    
    const audioContextNowReady = await startToneAudioContext();
    if (!audioContextNowReady) return;

    const newTime = Math.max(0, Math.min(time, durationTotal));
    setPlaybackTime(newTime);

    const wasPlaying = isPlaying;
    if (wasPlaying) Tone.Transport.pause();
    
    if (pianoRef.current) {
        for (let i = 21; i <= 108; i++) pianoRef.current.keyUp({ midi: i, time: Tone.now() });
    }

    scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
    scheduledEventsRef.current = [];
    Tone.Transport.cancel();
    
    if (!scheduleNotesForGlobalPlayer()) {
        setPlayerError("Failed to reschedule after seek.");
        if(wasPlaying) setIsPlaying(false);
        return;
    }
    
    Tone.Transport.seconds = newTime;

    if (wasPlaying) Tone.Transport.start();

  }, [currentPlayingMidi, isMidiDataLoaded, isPianoSamplerReady, durationTotal, isPlaying, scheduleNotesForGlobalPlayer]);

  const togglePlayerMute = useCallback(async () => {
    if (!isPianoSamplerReady || !pianoRef.current) return;
    const audioContextNowReady = await startToneAudioContext();
    if (!audioContextNowReady) return;

    const newMuteState = !isMuted;
    if (pianoRef.current.volume) {
      pianoRef.current.volume.mute = newMuteState;
    }
    setIsMuted(newMuteState);
  }, [isPianoSamplerReady, isMuted]);

  const value = {
    currentPlayingMidi,
    isPlaying,
    playbackTime,
    durationTotal,
    isMidiDataLoaded,
    isPianoSamplerReady,
    isLoadingPlayer,
    playerError,
    isMuted,
    playMidi,
    togglePlay: togglePlayControls,
    seekPlayer,
    togglePlayerMute,
    stopCurrentTrackAudio, // Renamed
    clearAndClosePlayer,   // New function for full close
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};