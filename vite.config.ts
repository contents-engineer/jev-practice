import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import emotionFace from './projects/emotion-face/server.ts';
import { jevApi } from './server/api.ts';
import { findProjects, projectIndex } from './server/projects.ts';

// Each projects/<name>/index.html is its own page at /<name>/; projects/index.html is the hub at /.
const ROOT = 'projects';

export default defineConfig(({ mode }) => {
  // Loaded on the Node side only; variables without a VITE_ prefix never reach the client bundle.
  const env = loadEnv(mode, process.cwd(), '');
  const pages = Object.fromEntries(findProjects(ROOT).map(({ slug }) => [slug, resolve(ROOT, slug, 'index.html')]));

  return {
    root: ROOT,
    appType: 'mpa', // unknown paths 404 instead of falling back to the hub
    publicDir: '../public', // static files shared by every project, served from /
    envDir: '..',
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      rolldownOptions: { input: { index: resolve(ROOT, 'index.html'), ...pages } },
    },
    plugins: [
      // Server routes per project, served at POST /api/<project>/<route>.
      jevApi(env.TYPESAFE_AI_API, { 'emotion-face': emotionFace }),
      projectIndex(ROOT),
    ],
  };
});
