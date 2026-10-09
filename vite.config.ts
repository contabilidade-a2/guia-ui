import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Local development against a deployed back-end (whose CORS only allows the published site):
//   DEV_API_PROXY=https://<service>.onrender.com VITE_API_URL= npm run dev
// The dev server then forwards /api calls to it, so the browser never makes a cross-origin request.
const devApiProxy = process.env.DEV_API_PROXY

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths, so the build works under any GitHub Pages sub-path.
  base: './',
  plugins: [react()],
  server: devApiProxy
    ? {
        proxy: {
          '/api': {
            target: devApiProxy,
            changeOrigin: true,
            // Without an Origin header the back-end treats the call as same-origin and skips its CORS check.
            configure: (proxy) => proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin')),
          },
        },
      }
    : undefined,
})
