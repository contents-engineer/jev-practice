import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Connect, Plugin } from 'vite';

/**
 * Runs the Vercel Functions in api/ inside the Vite dev server: /api/a/b is answered by
 * api/a/b.ts, loaded through Vite so edits take effect on the next request.
 */
export function devApi(dir = 'api'): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      const handle: Connect.NextHandleFunction = async (req, res, next) => {
        // Mounted at /api, so this is /<project>/<route>.
        const path = new URL(req.url ?? '/', 'http://localhost').pathname;
        const file = join(process.cwd(), dir, `${path}.ts`);
        if (!/^(\/[\w-]+)+$/.test(path) || !existsSync(file)) return next();
        try {
          const { default: fn } = await server.ssrLoadModule(file);
          const response: Response = await fn.fetch(await toRequest(req));
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          next(err);
        }
      };
      server.middlewares.use('/api', handle);
    },
  };
}

async function toRequest(req: Connect.IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    for (const v of [value ?? []].flat()) headers.append(name, v);
  }
  return new Request(new URL(req.originalUrl ?? req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`), {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
  });
}
