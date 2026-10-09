import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The CleverTap Recommendation API does not allow direct browser calls (CORS),
// so the app calls /ct/<region>/... and Vite forwards it server-side.
// Add a region here if your account lives somewhere else.
export const REGIONS = ['eu1', 'in1', 'us1', 'sg1', 'aps3', 'mec1'];

const proxy = Object.fromEntries(
  REGIONS.map((region) => [
    `/ct/${region}/`,
    {
      target: `https://${region}.recommendation.clevertap.com`,
      changeOrigin: true,
      secure: true,
      rewrite: (path) => path.replace(`/ct/${region}`, ''),
      configure: (p) => {
        // Look like a server-to-server call, the same as cURL.
        p.on('proxyReq', (req) => {
          req.removeHeader('origin');
          req.removeHeader('referer');
        });
      },
    },
  ])
);

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
});
