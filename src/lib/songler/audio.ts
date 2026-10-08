'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { previewPath } from './pool';

/**
 * Songler's player — docs/songler-spec.md, section 3. The 30-second preview is
 * decoded with Web Audio, so a snippet stops at exactly half a second, where
 * an <audio> element overshoots by a tenth or more. Decoded previews are kept
 * for the page's life, so the next round's song can be loaded while everyone
 * looks at the results.
 */

let context: AudioContext | null = null;
let gain: GainNode | null = null;
const VOLUME_KEY = 'songler-volume';
const VOLUME_EVENT = 'dg:music-volume';

function audio(): { ctx: AudioContext; out: GainNode } {
  if (!context) {
    context = new AudioContext();
    gain = context.createGain();
    gain.gain.value = storedVolume();
    gain.connect(context.destination);
  }
  return { ctx: context, out: gain! };
}

/** Songler's music volume, 0–1; the settings and the game's own slider share it. */
export function storedVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw === null) return 0.8;
    const v = Number(raw);
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.8;
  } catch {
    return 0.8;
  }
}

export function setMusicVolume(v: number) {
  const clamped = Math.min(1, Math.max(0, v));
  if (gain) gain.gain.value = clamped;
  try { localStorage.setItem(VOLUME_KEY, String(clamped)); } catch { /* private mode */ }
  window.dispatchEvent(new Event(VOLUME_EVENT));
}

const buffers = new Map<number, Promise<AudioBuffer>>();

/** The decoded preview of a song, fetched once. A failure is forgotten, so the next ask tries again. */
export function loadSong(id: number): Promise<AudioBuffer> {
  let buffer = buffers.get(id);
  if (!buffer) {
    buffer = fetch(previewPath(id))
      .then((res) => {
        if (!res.ok) throw new Error(`preview ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => audio().ctx.decodeAudioData(data));
    buffer.catch(() => buffers.delete(id));
    buffers.set(id, buffer);
  }
  return buffer;
}

/** Starts loading a song before its round. */
export const preloadSong = (id: number) => { loadSong(id).catch(() => {}); };

export type PlayerStatus = 'loading' | 'ready' | 'error';

/**
 * Plays the start of a song's preview. `play(seconds)` plays from the top
 * for that long; `elapsed` follows the playback for the progress bar.
 */
export function useSnippetPlayer(songId: number | null) {
  const [loaded, setLoaded] = useState<{ id: number; buffer: AudioBuffer | null } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  // The game screen renders only in the browser; on a server the read falls back to 0.8.
  const [volume, setVolumeState] = useState(storedVolume);
  const source = useRef<AudioBufferSourceNode | null>(null);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (songId === null) return;
    let live = true;
    loadSong(songId)
      .then((buffer) => { if (live) setLoaded({ id: songId, buffer }); })
      .catch(() => { if (live) setLoaded({ id: songId, buffer: null }); });
    return () => { live = false; };
  }, [songId]);

  const buffer = loaded && loaded.id === songId ? loaded.buffer : undefined;
  const status: PlayerStatus = songId === null || buffer === undefined ? 'loading' : buffer ? 'ready' : 'error';

  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    try { source.current?.stop(); } catch { /* already stopped */ }
    source.current = null;
    setPlaying(false);
  }, []);

  const play = useCallback((seconds: number) => {
    if (!buffer) return;
    stop();
    const { ctx, out } = audio();
    // The page's first sound needs a gesture; play is always called from one.
    void ctx.resume();
    const node = ctx.createBufferSource();
    node.buffer = buffer;
    node.connect(out);
    const length = Math.min(seconds, buffer.duration);
    const startedAt = ctx.currentTime;
    node.start(0, 0, length);
    node.onended = () => {
      if (source.current !== node) return;
      source.current = null;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      setPlaying(false);
      setElapsed(length);
    };
    source.current = node;
    setPlaying(true);
    setElapsed(0);
    const tick = () => {
      setElapsed(Math.min(length, ctx.currentTime - startedAt));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [buffer, stop]);

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.min(1, Math.max(0, v)));
    setMusicVolume(v);
  }, []);

  // The settings can change it while a round is on
  useEffect(() => {
    const sync = () => setVolumeState(storedVolume());
    window.addEventListener(VOLUME_EVENT, sync);
    return () => window.removeEventListener(VOLUME_EVENT, sync);
  }, []);

  // A new song, or leaving the page, silences the old one.
  useEffect(() => stop, [songId, stop]);

  return { status, playing, elapsed, duration: buffer?.duration ?? 30, play, stop, volume, setVolume };
}
