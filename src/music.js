import { useEffect, useRef } from 'react';

/**
 * The couple's own track, looping under the invitation.
 *
 * Nothing is downloaded until a guest actually asks for sound, so the 1.4MB of
 * audio costs nothing to everyone who never presses the button. Browsers that
 * support Ogg Opus get that; Safari falls back to the MP3.
 */
const base = import.meta.env.BASE_URL;

const SOURCES = [
  { url: `${base}assets/audio/wedding.opus`, type: 'audio/ogg; codecs=opus' },
  { url: `${base}assets/audio/wedding.mp3`, type: 'audio/mpeg' },
];

const VOLUME = 0.42;   // background level: present, never over the top
const FADE_IN = 1200;
const FADE_OUT = 550;

function bestSource() {
  const probe = document.createElement('audio');
  const supported = SOURCES.find(source => probe.canPlayType(source.type));
  return (supported ?? SOURCES[SOURCES.length - 1]).url;
}

/** Ramps volume over time, replacing any ramp already running on that element. */
function fade(element, to, duration, state) {
  cancelAnimationFrame(state.frame);
  const from = element.volume;
  if (duration <= 0 || from === to) {
    element.volume = to;
    return Promise.resolve();
  }
  const started = performance.now();
  return new Promise(resolve => {
    const step = now => {
      const t = Math.min(1, (now - started) / duration);
      // Perceived loudness is closer to the square of the gain.
      element.volume = Math.max(0, Math.min(1, from + (to - from) * t * t));
      if (t < 1) state.frame = requestAnimationFrame(step);
      else resolve();
    };
    state.frame = requestAnimationFrame(step);
  });
}

/**
 * @param enabled   whether the guest has asked for sound
 * @param onBlocked called if the browser refuses to play, so the control can
 *                  show itself as muted rather than claiming to be playing
 */
export function useAmbientMusic(enabled, onBlocked) {
  const element = useRef(null);
  const ramp = useRef({ frame: 0 });
  const blocked = useRef(onBlocked);
  blocked.current = onBlocked;

  useEffect(() => {
    if (!enabled) {
      const audio = element.current;
      if (!audio) return;
      let stopped = false;
      fade(audio, 0, FADE_OUT, ramp.current).then(() => { if (!stopped) audio.pause(); });
      return () => { stopped = true; };
    }

    if (!element.current) {
      const audio = new Audio();
      audio.src = bestSource();
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = 0;
      element.current = audio;
    }

    const audio = element.current;
    let cancelled = false;
    audio.volume = 0;
    Promise.resolve(audio.play())
      .then(() => { if (!cancelled) fade(audio, VOLUME, FADE_IN, ramp.current); })
      // Autoplay policies, a missing file, or an unsupported codec all land here.
      .catch(() => { if (!cancelled) blocked.current?.(); });

    // Do not keep playing to an empty room.
    const visibility = () => {
      if (document.hidden) audio.pause();
      else Promise.resolve(audio.play()).catch(() => {});
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [enabled]);

  // Release the audio when the whole invitation unmounts.
  useEffect(() => () => {
    cancelAnimationFrame(ramp.current.frame);
    const audio = element.current;
    if (!audio) return;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    element.current = null;
  }, []);
}
