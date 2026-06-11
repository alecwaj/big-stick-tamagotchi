import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// vite-plugin-pwa's workbox-build is incompatible with vite@8 (forced install).
// PWA manifest is wired manually via public/manifest.webmanifest + meta tags in index.html.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
  },
});
