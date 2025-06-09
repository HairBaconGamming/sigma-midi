// client/src/contexts/PlayerContext.jsx
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
import { Midi as ToneMidi } from '@tonejs/midi';
import { Piano } from '@tonejs/piano';
import { getMidiFileStreamUrl, getAllMidis } from '../services/apiMidis';

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

  const [isLooping, setIsLooping] = useState(false);
  const [isAutoplayNext, setIsAutoplayNext] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  const pianoRef = useRef(null);
  const parsedMidiFileRef = useRef(null);
  const scheduledEventsRef = useRef([]);
  const animationFrameRef = useRef(null);
  const toneContextStarted = useRef(false);
  const previousVolumeRef = useRef(volume);
  const playMidiRef = useRef(null); // Ref to hold the playMidi function

  const linearToDb = (linVol) => {
    if (linVol <= 0.001) return -Infinity; // Threshold for true mute
    return Tone.gainToDb(linVol); // Use Tone.js's utility for gain to dB
  };

  useEffect(() => {
    if (!pianoRef.current && !isPianoSamplerReady) {
      console.log("Global Player: Initializing Piano...");
      setIsLoadingPlayer(true);
      const piano = new Piano({ velocities: 4, release: true });
      piano.toDestination();
      pianoRef.current = piano;

      piano.load()
        .then(() => {
          console.log("Global Player: Piano samples loaded successfully.");
          setIsPianoSamplerReady(true);
          setIsLoadingPlayer(false);
          // Initial volume will be set by the dedicated volume useEffect
        })
        .catch(err => {
          console.error("Global Player: Failed to load piano samples:", err);
          setPlayerError("Could not load piano sound. " + (err.message || ""));
          setIsPianoSamplerReady(false);
          setIsLoadingPlayer(false);
          if (pianoRef.current) {
            pianoRef.current.dispose();
            pianoRef.current = null;
          }
        });
    }

    return () => {
      if (pianoRef.current) {
        pianoRef.current.dispose();
        pianoRef.current = null;
        console.log("Global Player: Piano disposed on context unmount/re-init.");
      }
      Tone.Transport.stop();
      Tone.Transport.cancel();
      scheduledEventsRef.current.forEach(id => Tone.Transport.clear(id));
      scheduledEventsRef.current = [];
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPianoSamplerReady]);

  useEffect(() => {
    if (isPianoSamplerReady && pianoRef.current && pianoRef.current.output) {
      if (pianoRef.current.output.volume && typeof pianoRef.current.output.volume.value !== 'undefined') {
        if (isMuted) {
          pianoRef.current.output.volume.value = -Infinity;
          console.log("Global Player: Piano Muted (volume set to -Infinity).");
        } else {
          const dbValue = linearToDb(volume);
          pianoRef.current.output.volume.value = dbValue;
          console.log(`Global Player: Piano volume set to ${volume.toFixed(2)} linear (${dbValue !== -Infinity ? dbValue.toFixed(2) : '-Inf'} dB).`);
        }
      } else {
        console.warn("Global Player: pianoRef.current.output.volume or its .value is not available for setting.");
      }
    } else if (isPianoSamplerReady && pianoRef.current && !pianoRef.current.output) {
        console.warn("Global Player: Piano is ready, but pianoRef.current.output is not defined. Cannot set volume.");
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

  const _playMidiInternal = useCallback(async (midiData) => { // Renamed to avoid conflict in useEffect deps
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
    // _internalTogglePlay will be called by playMidiRef.current
    if (playMidiRef.current && playMidiRef.current._internalTogglePlay) {
        playMidiRef.current._internalTogglePlay(midiData, true);
    } else {
        console.error("Global Player: _internalTogglePlay not available on playMidiRef.current");
    }
  }, [isPianoSamplerReady, currentPlayingMidi, isMidiDataLoaded, loadAndParseMidi /* _internalTogglePlay removed */]);

  const playNextMidi = useCallback(async () => {
    if (!currentPlayingMidi) return;
    console.log("Global Player: Attempting to play next MIDI...");
    try {
        const res = await getAllMidis({ limit: 5, sortBy: 'random' });
        let nextMidiToPlay = null;
        if (res.data && res.data.midis && res.data.midis.length > 0) {
            nextMidiToPlay = res.data.midis.find(m => m._id !== currentPlayingMidi._id);
            if (!nextMidiToPlay && res.data.midis.length > 0) nextMidiToPlay = res.data.midis[0];
        }
        if (nextMidiToPlay && nextMidiToPlay._id !== currentPlayingMidi._id) {
            console.log("Global Player: Autoplaying next MIDI:", nextMidiToPlay.title);
            if (playMidiRef.current && playMidiRef.current.playMidi) {
                await playMidiRef.current.playMidi(nextMidiToPlay);
            } else {
                 console.error("Global Player: playMidi not available on playMidiRef.current for autoplay");
            }
        } else {
            console.log("Global Player: No different MIDI found to autoplay or end of list.");
            setIsPlaying(false);
        }
    } catch (error) {
        console.error("Global Player: Error fetching next MIDI for autoplay:", error);
        setIsPlaying(false);
    }
  }, [currentPlayingMidi /* playMidi removed */]);

  const updateProgressLoop = useCallback(() => {
    if (Tone.Transport.state === "started" && parsedMidiFileRef.current) {
      const currentTime = Tone.Transport.seconds;
      setPlaybackTime(currentTime);
      if (currentTime >= durationTotal - 0.05 && durationTotal > 0) {
        console.log("Global Player: MIDI end reached for", parsedMidiFileRef.current.name);
        Tone.Transport.stop(); setPlaybackTime(0); Tone.Transport.seconds = 0;
        if (isLooping) {
          console.log("Global Player: Looping", parsedMidiFileRef.current.name);
          if (scheduleNotesForGlobalPlayer()) Tone.Transport.start(); else setIsPlaying(false);
        } else if (isAutoplayNext) {
            playNextMidi();
        } else {
          setIsPlaying(false); if (parsedMidiFileRef.current) scheduleNotesForGlobalPlayer();
        }
      } else {
        animationFrameRef.current = requestAnimationFrame(updateProgressLoop);
      }
    }
  }, [durationTotal, scheduleNotesForGlobalPlayer, isLooping, isAutoplayNext, playNextMidi]);

  useEffect(() => {
    if (isPlaying) animationFrameRef.current = requestAnimationFrame(updateProgressLoop);
    else if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
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
  
  // Assign to ref after definition
  useEffect(() => {
    playMidiRef.current = {
        playMidi: _playMidiInternal,
        _internalTogglePlay: _internalTogglePlay
    };
  }, [_playMidiInternal, _internalTogglePlay]);


  const generalTogglePlay = useCallback(() => {
    if (currentPlayingMidi && parsedMidiFileRef.current) {
      if (playMidiRef.current && playMidiRef.current._internalTogglePlay) {
        playMidiRef.current._internalTogglePlay(currentPlayingMidi, undefined);
      }
    } else {
      if (!currentPlayingMidi) setPlayerError("No MIDI selected to play/pause.");
      else if (!isMidiDataLoaded) setPlayerError("MIDI data not loaded yet.");
    }
  }, [currentPlayingMidi, isMidiDataLoaded /* _internalTogglePlay removed */]);

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
    if (clampedVolume > 0 && isMuted) setIsMuted(false);
    previousVolumeRef.current = clampedVolume;
  }, [isMuted]);

  const toggleMuteOnly = useCallback(() => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    if (newMuteState) previousVolumeRef.current = volume;
  }, [isMuted, volume]);

  const value = {
    currentPlayingMidi, isPlaying, playbackTime, durationTotal, isMidiDataLoaded,
    isPianoSamplerReady, isLoadingPlayer, playerError,
    isLooping, setIsLooping, isAutoplayNext, setIsAutoplayNext,
    volume, setVolume: handleSetVolume, isMuted, toggleMute: toggleMuteOnly,
    playMidi: (midiData) => playMidiRef.current?.playMidi(midiData), // Call through ref
    togglePlay: generalTogglePlay,
    seekPlayer, stopCurrentTrackAudio, clearAndClosePlayer,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};