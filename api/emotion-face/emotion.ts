import { readEmotion } from '../../projects/emotion-face/server.ts';
import { serve } from '../../server/api.ts';

/** POST /api/emotion-face/emotion with `{ text }`: a Vercel Function, also run by the Vite dev server. */
export default serve(readEmotion);
