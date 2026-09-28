import { TypeSafeClient } from '@typesafe-ai/sdk';

/** A server route: the parsed JSON body in, JSON out. */
export type Route = (body: unknown, jev: TypeSafeClient) => Promise<unknown>;

/** Throw from a route to answer with this status instead of 502. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

let jev: TypeSafeClient | undefined;

/**
 * Wraps a route as a Vercel Function (the `fetch` Web standard export). The Vite dev server
 * runs the same files, so api/<project>/<route>.ts behaves the same locally and on Vercel,
 * and the API key only ever lives on the server.
 */
export function serve(route: Route) {
  return {
    async fetch(request: Request): Promise<Response> {
      if (request.method !== 'POST') return Response.json({ error: 'Use POST' }, { status: 405 });
      const apiKey = process.env.TYPESAFE_AI_API;
      if (!apiKey) {
        return Response.json(
          { error: 'TYPESAFE_AI_API is not set (.env locally, Environment Variables on Vercel)' },
          { status: 500 },
        );
      }
      jev ??= new TypeSafeClient({ apiKey });

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json({ error: 'Expected a JSON body' }, { status: 400 });
      }
      try {
        return Response.json(await route(body, jev));
      } catch (err) {
        if (err instanceof HttpError) return Response.json({ error: err.message }, { status: err.status });
        return Response.json({ error: err instanceof Error ? err.message : 'Jev request failed' }, { status: 502 });
      }
    },
  };
}
