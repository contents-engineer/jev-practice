import type { IncomingMessage, ServerResponse } from 'node:http';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import type { Connect, Plugin } from 'vite';

/** A project's server-side handler: the parsed JSON body in, JSON out. */
export type Route = (body: unknown, jev: TypeSafeClient) => Promise<unknown>;

/** What a project's `server.ts` exports by default; each key is served at `POST /api/<project>/<key>`. */
export type Routes = Record<string, Route>;

/** Throw from a route to answer with this status instead of 502. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Serves every project's routes from the Vite dev/preview server, with one TypeSafe client
 * for all of them, so the API key never reaches the browser.
 */
export function jevApi(apiKey: string | undefined, projects: Record<string, Routes>): Plugin {
  const jev = apiKey ? new TypeSafeClient({ apiKey }) : undefined;

  const handle: Connect.NextHandleFunction = async (req, res, next) => {
    // Mounted at /api, so the URL here is /<project>/<route>.
    const [, project, name] = new URL(req.url ?? '/', 'http://localhost').pathname.split('/');
    const route = projects[project]?.[name];
    if (!route) return next();
    if (req.method !== 'POST') return send(res, 405, { error: 'Use POST' });
    if (!jev) return send(res, 500, { error: 'TYPESAFE_AI_API is missing from .env' });

    let body: unknown;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return send(res, 400, { error: 'Expected a JSON body' });
    }
    try {
      send(res, 200, await route(body, jev));
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message });
      send(res, 502, { error: err instanceof Error ? err.message : 'Jev request failed' });
    }
  };

  return {
    name: 'jev-api',
    configureServer(server) {
      server.middlewares.use('/api', handle);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api', handle);
    },
  };
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}
