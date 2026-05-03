import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          '@react-three/fiber': path.resolve(__dirname, 'tests/__stubs__/r3f-fiber.tsx'),
          '@react-three/drei': path.resolve(__dirname, 'tests/__stubs__/r3f-drei.ts'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: (id) => {
              if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'vendor-firebase';
              if (id.includes('node_modules/@google/genai')) return 'vendor-ai';
              if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'vendor-charts';
              if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) return 'vendor-pdf';
              if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler') || id.includes('node_modules/react-markdown') || id.includes('node_modules/react-webcam') || id.includes('node_modules/motion') || id.includes('node_modules/lucide-react') || id.includes('node_modules/lodash')) return 'vendor-react';
            },
          },
        },
      },
      test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./tests/setup.ts'],
      },
    };
});
