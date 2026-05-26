// src/audio.js — Mixkit CDN audio manager
const SOUNDS = {
  swap:        "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
  drumroll:    "https://assets.mixkit.co/active_storage/sfx/2676/2676-preview.mp3",
  confetti:    "https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3",
  transition:  "https://assets.mixkit.co/active_storage/sfx/2580/2580-preview.mp3",
  block:       "https://assets.mixkit.co/active_storage/sfx/2570/2570-preview.mp3",
  reveal:      "https://assets.mixkit.co/active_storage/sfx/2619/2619-preview.mp3",
  tick:        "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
  winnerJingle:"https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3",
};

const cache = {};

function play(name, volume = 0.6) {
  try {
    if (!cache[name]) {
      cache[name] = new Audio(SOUNDS[name]);
    }
    const audio = cache[name];
    audio.currentTime = 0;
    audio.volume = volume;
    audio.play().catch(() => {}); // ignore autoplay block
  } catch (_) {}
}

export const sfx = { play };
export default sfx;
