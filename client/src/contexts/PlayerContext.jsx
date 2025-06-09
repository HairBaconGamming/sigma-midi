// client/src/contexts/PlayerContext.jsx
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
import { Midi as ToneMidi } from '@tonejs/midi';
import { Piano } from '@tonejs/piano';
import { getMidiFileStreamUrl, getAllMidis } from '../services/apiMidis'; // Assuming getAllMidis for autoplay

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

  // New Settings States
  const [isLooping, setIsLooping] = useState(false);
  const [isAutoplayNext, setIsAutoplayNext] = useState(false);
  const [volume, setVolume] = useState(0.8); // Volume from 0 to 1 (maps to -Infinity to 0 dB for Tone.js)
  const [isMuted, setIsMuted] = useState(false); // Keep isMuted for quick toggle, volume slider will override

  const pianoRef = useRef(null);
  const parsedMidiFileRef = useRef(null);
  const scheduledEventsRef = useRef([]);
  const animationFrameRef = useRef(null);
  const toneContextStarted = useRef(false);
  const previousVolumeRef = useRef(volume); // To store volume before mute

  // Convert linear volume (0-1) to dB for Tone.js
  const linearToDb = (linVol) => {
    if (linVol <= 0) return -Infinity;
    return 20 * Math.log10(linVol);
  };

  useEffect(() => {
    if (!pianoRef.current && !isPianoSamplerReady) {
      console.log("Global Player: Initializing Piano...");
      setIsLoadingPlayer(true);
      const piano = new Piano({ velocities: 4, release: true });
      piano.toDestination(); // Connects to master out
      pianoRef.current = piano;
      piano.load()
        .then(() => {
          setIsPianoSamplerReady(true);
          setIsLoadingPlayer(false);
          // Set initial volume
          if (pianoRef.current.output) {
            pianoRef.current.output.volume.value = linearToDb(volume);
          }
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
    return () => {
        if (pianoRef.current) {
            pianoRef.current.dispose();
            pianoRef.current = null;
        }
        Tone.Transport.stop();
        Tone.Transport.cancel();
        scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPianoSamplerReady]); // Removed volume from here to avoid re-init on volume change

  // Effect to update Tone.js volume when `volume` state changes or `isMuted` changes
  useEffect(() => {
    if (pianoRef.current && pianoRef.current.output && isPianoSamplerReady) {
      if (isMuted) {
        pianoRef.current.output.volume.value = -Infinity;
      } else {
        pianoRef.current.output.volume.value = linearToDb(volume);
      }
    }
  }, [volume, isMuted, isPianoSamplerReady]);


  const stopCurrentTrackAudio = useCallback((resetPlayback = true) => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
    scheduledEventsRef.current = [];
    if (pianoRef.current && isPianoSamplerReady) {
      for (let i = 21; i <= 108; i++) pianoRef.current.keyUp({ midi: i, time: Tone.now() });
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setIsPlaying(false);
    if (resetPlayback) {
        setPlaybackTime(0);
    }
  }, [isPianoSamplerReady]);

  const clearAndClosePlayer = useCallback(() => {
    stopCurrentTrackAudio(true);
    setCurrentPlayingMidi(null);
    parsedMidiFileRef.current = null;
    setIsMidiDataLoaded(false);
    setDurationTotal(0);
    setPlayerError('');
  }, [stopCurrentTrackAudio]);

  const loadAndParseMidi = useCallback(async (midiToLoad) => {
    if (!midiToLoad || !midiToLoad.fileId) {
      setPlayerError("No file ID provided for playback."); return false;
    }
    if (!isPianoSamplerReady || !pianoRef.current) {
      setPlayerError("Piano sound not ready."); return false;
    }
    stopCurrentTrackAudio(true);
    setIsLoadingPlayer(true); setPlayerError(''); setIsMidiDataLoaded(false); parsedMidiFileRef.current = null;
    try {
      const midiUrl = getMidiFileStreamUrl(midiToLoad.fileId);
      const parsed = await ToneMidi.fromUrl(midiUrl);
      parsedMidiFileRef.current = parsed;
      setDurationTotal(parsed.duration);
      setCurrentPlayingMidi(midiToLoad); setIsMidiDataLoaded(true);
      console.log("Global Player: MIDI parsed:", parsed.name);
      return true;
    } catch (e) {
      console.error("Global Player: Error loading/parsing MIDI:", e);
      setPlayerError(`Could not load MIDI: ${e.message}`); setCurrentPlayingMidi(null); return false;
    } finally {
      setIsLoadingPlayer(false);
    }
  }, [isPianoSamplerReady, stopCurrentTrackAudio]);

  const scheduleNotesForGlobalPlayer = useCallback(() => {
    if (!parsedMidiFileRef.current || !pianoRef.current || !isPianoSamplerReady) return false;
    scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
    scheduledEventsRef.current = []; Tone.Transport.cancel();
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
    console.log("Global Player: Notes scheduled for", parsedMidiFileRef.current.name);
    return true;
  }, [isPianoSamplerReady]);

  const startToneAudioContext = async () => {
    if (Tone.context.state !== 'running') {
      try {
        await Tone.start(); toneContextStarted.current = true; console.log("Global Player: Tone AudioContext started."); return true;
      } catch (e) {
        setPlayerError("Audio context error. Please interact with the page."); console.error("Global Player: Error starting Tone AudioContext:", e); return false;
      }
    }
    return true;
  };

  const playNextMidi = useCallback(async () => {
    if (!currentPlayingMidi) return;
    console.log("Global Player: Attempting to play next MIDI...");
    try {
        // Basic: fetch a random MIDI or the next one in some list.
        // This is a simplified example. A real implementation might involve a playlist.
        const res = await getAllMidis({ limit: 5, sortBy: 'random' }); // Fetch a few random ones
        let nextMidiToPlay = null;
        if (res.data && res.data.midis && res.data.midis.length > 0) {
            nextMidiToPlay = res.data.midis.find(m => m._id !== currentPlayingMidi._id);
            if (!nextMidiToPlay && res.data.midis.length > 0) nextMidiToPlay = res.data.midis[0]; // Fallback to first if different not found
        }

        if (nextMidiToPlay && nextMidiToPlay._id !== currentPlayingMidi._id) {
            console.log("Global Player: Autoplaying next MIDI:", nextMidiToPlay.title);
            // playMidi will handle loading and starting
            // Need to ensure playMidi is available in this scope or pass it if defined later
            // For now, assuming playMidi (defined below) will be used.
            // This creates a slight circular dependency in thought, but React handles it.
            // We'll call the fully defined playMidi function.
            await playMidi(nextMidiToPlay);
        } else {
            console.log("Global Player: No different MIDI found to autoplay or end of list.");
            setIsPlaying(false); // Stop if no next
        }
    } catch (error) {
        console.error("Global Player: Error fetching next MIDI for autoplay:", error);
        setIsPlaying(false);
    }
  }, [currentPlayingMidi]); // playMidi will be added to dependency array of the outer playMidi

  const updateProgressLoop = useCallback(() => {
    if (Tone.Transport.state === "started" && parsedMidiFileRef.current) {
      const currentTime = Tone.Transport.seconds;
      setPlaybackTime(currentTime);
      if (currentTime >= durationTotal - 0.05 && durationTotal > 0) {
        console.log("Global Player: MIDI end reached for", parsedMidiFileRef.current.name);
        Tone.Transport.stop(); // Stop current
        setPlaybackTime(0); Tone.Transport.seconds = 0; // Reset for current track

        if (isLooping) {
          console.log("Global Player: Looping", parsedMidiFileRef.current.name);
          if (scheduleNotesForGlobalPlayer()) {
            Tone.Transport.start(); // Restart immediately
            // isPlaying remains true
          } else {
            setIsPlaying(false);
          }
        } else if (isAutoplayNext) {
            playNextMidi(); // This will set isPlaying if successful
        } else {
          setIsPlaying(false); // Just stop if no loop or autoplay
          if (parsedMidiFileRef.current) scheduleNotesForGlobalPlayer(); // Reschedule for manual replay
        }
      } else {
        animationFrameRef.current = requestAnimationFrame(updateProgressLoop);
      }
    }
  }, [durationTotal, scheduleNotesForGlobalPlayer, isLooping, isAutoplayNext, playNextMidi]);

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

  const _internalTogglePlay = useCallback(async (midiToOperateOn, forcePlay) => {
    if (!midiToOperateOn || !isMidiDataLoaded || !isPianoSamplerReady || !pianoRef.current) {
      setPlayerError("Cannot play: Player not fully ready."); return;
    }
    const audioContextNowReady = await startToneAudioContext();
    if (!audioContextNowReady) return;
    const currentTransportState = Tone.Transport.state;
    if (currentPlayingMidi && currentPlayingMidi._id === midiToOperateOn._id && currentTransportState === "started" && forcePlay !== true) {
      Tone.Transport.pause(); setIsPlaying(false); console.log("Global Player: Paused", midiToOperateOn.title);
    } else {
      if (currentTransportState === "stopped" || (currentPlayingMidi?._id !== midiToOperateOn._id) || scheduledEventsRef.current.length === 0) {
        Tone.Transport.seconds = playbackTime;
        if (!scheduleNotesForGlobalPlayer()) { setPlayerError("Failed to schedule notes for playback."); return; }
      }
      Tone.Transport.start(); setIsPlaying(true); console.log("Global Player: Playing", midiToOperateOn.title);
    }
  }, [isMidiDataLoaded, isPianoSamplerReady, playbackTime, scheduleNotesForGlobalPlayer, currentPlayingMidi]);

  const playMidi = useCallback(async (midiData) => {
    if (!midiData || !midiData.fileId) { setPlayerError("Invalid MIDI data to play."); return; }
    if (!isPianoSamplerReady) { setPlayerError("Piano sound is not ready yet. Please wait."); return; }
    console.log("Global Player: playMidi called for", midiData.title);
    const audioContextNowReady = await startToneAudioContext();
    if (!audioContextNowReady) return;
    if (!currentPlayingMidi || currentPlayingMidi._id !== midiData._id || !isMidiDataLoaded) {
      const loaded = await loadAndParseMidi(midiData);
      if (!loaded) return;
    }
    setPlaybackTime(0); Tone.Transport.seconds = 0;
    _internalTogglePlay(midiData, true);
  }, [isPianoSamplerReady, currentPlayingMidi, isMidiDataLoaded, loadAndParseMidi, _internalTogglePlay]);
  
  // Update playNextMidi's dependency array now that playMidi is fully defined above it.
  // This is a bit of a workaround for functions calling each other within the same hook closure.
  // A more advanced state machine or refactoring might avoid this.
  useEffect(() => {
    // This effect is just to ensure playNextMidi has the latest playMidi in its closure
    // if it were to be defined in a way that it captures an old playMidi.
    // However, with useCallback, playNextMidi should get the latest playMidi if playMidi is in its dep array.
    // The main issue is if playMidi itself is a dependency of playNextMidi's definition.
    // For now, the current structure should work as playNextMidi is called by updateProgressLoop,
    // and updateProgressLoop has playNextMidi in its deps.
  }, [playMidi]);


  const generalTogglePlay = useCallback(() => {
    if (currentPlayingMidi && parsedMidiFileRef.current) {
      _internalTogglePlay(currentPlayingMidi, undefined);
    } else {
      if (!currentPlayingMidi) setPlayerError("No MIDI selected to play/pause.");
      else if (!isMidiDataLoaded) setPlayerError("MIDI data not loaded yet.");
    }
  }, [currentPlayingMidi, _internalTogglePlay, isMidiDataLoaded]);

  const seekPlayer = useCallback(async (time) => {
    if (!currentPlayingMidi || !isMidiDataLoaded || !parsedMidiFileRef.current || !isPianoSamplerReady || durationTotal <= 0) return;
    const audioContextNowReady = await startToneAudioContext();
    if (!audioContextNowReady) return;
    const newTime = Math.max(0, Math.min(time, durationTotal));
    setPlaybackTime(newTime);
    const wasPlaying = isPlaying;
    if (wasPlaying) Tone.Transport.pause();
    if (pianoRef.current) { for (let i = 21; i <= 108; i++) pianoRef.current.keyUp({ midi: i, time: Tone.now() }); }
    scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
    scheduledEventsRef.current = []; Tone.Transport.cancel();
    if (!scheduleNotesForGlobalPlayer()) {
      setPlayerError("Failed to reschedule notes after seek."); if(wasPlaying) setIsPlaying(false); return;
    }
    Tone.Transport.seconds = newTime;
    if (wasPlaying) Tone.Transport.start();
  }, [currentPlayingMidi, isMidiDataLoaded, isPianoSamplerReady, durationTotal, isPlaying, scheduleNotesForGlobalPlayer]);

  const handleSetVolume = useCallback((newVolume) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
    if (clampedVolume > 0 && isMuted) { // Unmute if volume is adjusted while muted
        setIsMuted(false);
    }
    previousVolumeRef.current = clampedVolume; // Store for unmuting
  }, [isMuted]);

  const toggleMuteOnly = useCallback(() => { // Renamed from togglePlayerMute
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    if (newMuteState) {
        previousVolumeRef.current = volume; // Save current volume
        // Volume change is handled by the useEffect watching `isMuted` and `volume`
    } else {
        // When unmuting, restore to previousVolumeRef.current if it was > 0,
        // or to a default if previous was 0.
        // The useEffect will handle setting the actual Tone.js volume.
        // No need to directly set pianoRef.current.output.volume.value here.
    }
  }, [isMuted, volume]);


  const value = {
    currentPlayingMidi,
    isPlaying,
    playbackTime,
    durationTotal,
    isMidiDataLoaded,
    isPianoSamplerReady,
    isLoadingPlayer,
    playerError,
    
    // Settings
    isLooping,
    setIsLooping,
    isAutoplayNext,
    setIsAutoplayNext,
    volume,
    setVolume: handleSetVolume, // Use the handler
    isMuted, // Still useful for UI to show mute state
    toggleMute: toggleMuteOnly, // Expose the specific mute toggle

    playMidi,
    togglePlay: generalTogglePlay,
    seekPlayer,
    stopCurrentTrackAudio,
    clearAndClosePlayer,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};