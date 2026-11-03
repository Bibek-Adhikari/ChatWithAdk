import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Provider keys that must never appear in the browser bundle.
// Their VITE_ names exist only so the dev server can use them as a fallback;
// in a production build we replace the values with empty strings as a final
// safety net, on top of the proxy-only code paths in services/*.
const CLIENT_SECRET_KEYS = [
  'VITE_GEMINI_API_KEY',
  'VITE_GROQ_API_KEY',
  'VITE_OPENROUTER_API_KEY',
  'VITE_EXPLAINER_API_KEY',
  'VITE_YOUTUBE_API_KEY',
  'VITE_WORLD_NEWS_API_KEY',
  'VITE_NEWSDATA_API_KEY',
  'VITE_TAVILY_API_KEY',
  'VITE_PICSART_API_KEY',
  'VITE_CODECRAFT_API_KEY',
  'VITE_IMAGE_API_URL',
];

function stripSecretsFromBundle(secrets: string[]) {
  return {
    name: 'strip-client-secrets',
    apply: 'build' as const,
    generateBundle(_options: unknown, bundle: Record<string, any>) {
      for (const file of Object.values(bundle)) {
        if (file?.type !== 'chunk' || typeof file.code !== 'string') continue;
        let changed = false;
        for (const secret of secrets) {
          if (file.code.includes(secret)) {
            file.code = file.code.split(secret).join('');
            changed = true;
          }
        }
        if (changed) {
          console.warn(`[strip-client-secrets] Removed provider credentials from ${file.fileName}`);
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const secrets = CLIENT_SECRET_KEYS
    .map((key) => env[key] || '')
    .filter((value) => value.length > 8);

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    plugins: [react(), stripSecretsFromBundle(secrets)],
    optimizeDeps: {
      include: ['mermaid']
    },
    build: {
      commonjsOptions: {
        include: [/node_modules/]
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
