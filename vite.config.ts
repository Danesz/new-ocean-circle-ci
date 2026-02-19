import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

/** Vite plugin that proxies step log output URLs to avoid CORS issues. */
function stepLogProxy(): Plugin {
  return {
    name: 'step-log-proxy',
    configureServer(server) {
      server.middlewares.use('/api/step-log', async (req, res) => {
        const parsed = new URL(req.url ?? '', 'http://localhost');
        const targetUrl = parsed.searchParams.get('url');

        if (!targetUrl) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing ?url= parameter' }));
          return;
        }

        try {
          const upstream = await fetch(targetUrl);
          if (!upstream.ok) {
            res.statusCode = upstream.status;
            res.end(await upstream.text());
            return;
          }

          const contentType = upstream.headers.get('content-type');
          res.setHeader('Content-Type', contentType ?? 'application/json');
          res.statusCode = 200;

          // Stream the body
          const body = await upstream.arrayBuffer();
          res.end(Buffer.from(body));
        } catch (err) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), stepLogProxy()],
  server: {
    proxy: {
      '/api/circleci': {
        target: 'https://circleci.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/circleci/, '/api/v2'),
      },
      '/api/circleci-v1': {
        target: 'https://circleci.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/circleci-v1/, '/api/v1.1'),
      },
    },
  },
})
