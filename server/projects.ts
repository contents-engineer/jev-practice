import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Connect, Plugin } from 'vite';

export interface Project {
  /** Folder name; the page is served at /<slug>/. */
  slug: string;
  title: string;
  description: string;
}

/** Every folder under `dir` that has an index.html is a project. */
export function findProjects(dir: string): Project[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^[\w-]+$/.test(entry.name))
    .filter((entry) => existsSync(join(dir, entry.name, 'index.html')))
    .map((entry) => {
      const html = readFileSync(join(dir, entry.name, 'index.html'), 'utf8');
      return {
        slug: entry.name,
        title: html.match(/<title>([^<]*)<\/title>/)?.[1].trim() || entry.name,
        description: html.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1] ?? '',
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Lists the projects on the hub page in place of `<!-- projects -->`, and redirects
 * `/<slug>` to `/<slug>/` so the relative URLs inside each page resolve.
 */
export function projectIndex(dir: string): Plugin {
  const redirect: Connect.NextHandleFunction = (req, res, next) => {
    const slug = req.url?.match(/^\/([\w-]+)$/)?.[1];
    if (!slug || !existsSync(join(dir, slug, 'index.html'))) return next();
    res.writeHead(301, { Location: `/${slug}/` }).end();
  };

  return {
    name: 'project-index',
    configureServer(server) {
      server.middlewares.use(redirect);
    },
    configurePreviewServer(server) {
      server.middlewares.use(redirect);
    },
    // Runs per request in dev, so a new project folder shows up on the next refresh.
    transformIndexHtml(html) {
      if (!html.includes('<!-- projects -->')) return html;
      const items = findProjects(dir).map(
        ({ slug, title, description }) =>
          `<li><a href="/${slug}/"><span class="entry__path">/${slug}</span>` +
          `<span class="entry__title">${title}</span><span class="entry__desc">${description}</span>` +
          `<span class="entry__go" aria-hidden="true">→</span></a></li>`,
      );
      const empty = '<li class="entry--empty">아직 실습이 없습니다. projects/ 아래에 index.html이 있는 폴더를 추가하세요.</li>';
      return html.replace('<!-- projects -->', items.join('\n') || empty);
    },
  };
}
