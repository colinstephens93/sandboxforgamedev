import { defineConfig } from 'vite';
export default defineConfig({
  base: './', // relative paths so the build works from any hosting path (GitHub Pages project site)
  server: { host: '127.0.0.1', port: 5173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: { main: 'index.html', studio: 'studio.html' }, // studio.html: the truck alone (src/studio)
      output: {
        manualChunks(id) {
          if (/node_modules[\\/](three|postprocessing|three-mesh-bvh)[\\/]/.test(id)) return 'vendor-three';
          if (/src[\\/]truck[\\/]/.test(id)) return 'truck-mesh';
          return undefined;
        },
      },
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
