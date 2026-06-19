import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split heavy deps into their own cacheable chunks. three is only pulled in by
        // the lazily-loaded EffectCanvas, so it stays out of the first-paint bundle.
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) {
            return 'three';
          }
          if (id.includes('@mediapipe/tasks-vision')) {
            return 'mediapipe';
          }
          return undefined;
        },
      },
    },
  },
});
