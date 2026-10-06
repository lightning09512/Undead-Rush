import { defineConfig } from 'vite';

export default defineConfig({
  // CrazyGames hosts games from a nested URL, so build asset URLs relative to
  // index.html instead of assuming the game is served from the domain root.
  base: './',
});
