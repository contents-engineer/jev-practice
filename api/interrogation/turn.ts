import { readTurn } from '../../projects/interrogation/server.ts';
import { serve } from '../../server/api.ts';

/** POST /api/interrogation/turn with `{ caseId, text, committed, adapted }`: how Jev reads the detective's words. */
export default serve(readTurn);
