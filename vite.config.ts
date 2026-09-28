import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import { devApi } from './server/dev-api.ts';
import { findProjects, projectIndex } from './server/projects.ts';

// Each projects/<name>/index.html is its own page at /<name>/; projects/index.html is the hub at /.
const ROOT = 'projects';

export default defineConfig(({ mode }) => {
  // Server code reads the key from process.env, as it does on Vercel; locally .env provides it.
  // Variables without a VITE_ prefix never reach the client bundle.
  const key = loadEnv(mode, process.cwd(), '').TYPESAFE_AI_API;
  if (key) process.env.TYPESAFE_AI_API ??= key;
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
    // api/<project>/<route>.ts are Vercel Functions; devApi runs the same files under `vite`.
    plugins: [devApi(), projectIndex(ROOT)],
  };
});
