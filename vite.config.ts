import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative paths so the build also works inside the Capacitor iOS app and on game portals.
  base: './',
});
