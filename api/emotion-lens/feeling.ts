import { readFeeling } from '../../projects/emotion-lens/server.ts';
import { serve } from '../../server/api.ts';

/** POST /api/emotion-lens/feeling with `{ text }`: a Vercel Function, also run by the Vite dev server. */
export default serve(readFeeling);
