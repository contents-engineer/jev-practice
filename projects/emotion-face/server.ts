import { choice, score, type SystemOneResult } from '@typesafe-ai/sdk';
import { HttpError, type Routes } from '../../server/api.ts';

const MODEL = 'jev-latest';
const MAX_CHARS = 2_000;

// Plutchik's eight basic emotions. `what` / `not_for` sharpen the borders between
// neighbours Jev would otherwise blur (joy vs trust, surprise vs anticipation, ...).
export const questions = {
  emotion: choice('When the recipient reads this message, which one emotion would they most likely feel?', {
    joy: {
      what: 'Happiness, delight, pride or relief: good news, celebration, love, praise',
      not_for: 'Calm reassurance without real delight (trust)',
    },
    trust: {
      what: 'Feeling safe, supported and able to rely on the sender: reassurance, loyalty, kind support, commitment',
      not_for: 'Excited happiness (joy)',
    },
    fear: {
      what: 'Feeling threatened, anxious or worried: danger, warnings, threats, something bad that might happen',
      not_for: 'Being startled by something unexpected but harmless (surprise)',
    },
    surprise: {
      what: 'Being caught off guard or astonished by something unexpected, good or bad',
      not_for: 'Looking forward to something that has not been revealed yet (anticipation)',
    },
    sadness: {
      what: 'Feeling hurt, let down, lonely or grieving: loss, rejection, disappointment, bad news that already happened',
      not_for: 'Hostile blame that provokes the recipient (anger)',
    },
    disgust: {
      what: 'Revulsion or strong disapproval: something gross, vile, offensive or morally repugnant',
      not_for: 'Hostility aimed at the recipient (anger)',
    },
    anger: {
      what: 'Feeling attacked, insulted, blamed, treated unfairly or provoked',
      not_for: 'Being hurt without hostility (sadness)',
    },
    anticipation: {
      what: 'Eager expectation or curiosity about something still to come: teasers, plans, upcoming events, cliffhangers',
      not_for: 'Reacting to something that has just happened (surprise)',
    },
  }),
  // Levels describe situations rather than bare degrees, as the Score docs recommend.
  intensity: score('How strongly would the recipient feel that emotion when reading the message?', [
    'Barely at all: neutral, routine or purely factual (logistics, small talk, no emotional stakes)',
    'Mildly: a slight, passing feeling (polite thanks, light teasing, a minor inconvenience)',
    'Moderately: a clear feeling that colors their mood (personal good or bad news, direct criticism, warm praise)',
    'Strongly: a powerful reaction that is hard to ignore (major life news, serious accusations, threats, betrayal, deep affection or loss)',
    'Overwhelmingly: intense, all-consuming emotion (life-changing or tragic events, extreme danger, profound love or grief)',
  ]),
};

export type EmotionId = keyof typeof questions.emotion.criteria;

function stateFor(message: string) {
  return {
    situation:
      'Someone is typing a message that will be sent to another person, the recipient. The message may be unfinished.',
    message_to_recipient: message,
  };
}

export interface EmotionReading {
  request: { model: string; state: ReturnType<typeof stateFor>; questions: typeof questions };
  response: SystemOneResult<typeof questions>;
  latency_ms: number;
}

export default {
  /** POST /api/emotion-face/emotion with `{ text }`: how the recipient would feel, and how strongly. */
  async emotion(body, jev): Promise<EmotionReading> {
    const text = (body as { text?: unknown } | null)?.text;
    if (typeof text !== 'string' || !text.trim()) throw new HttpError(400, '"text" must be a non-empty string');
    if (text.length > MAX_CHARS) throw new HttpError(413, `Messages are limited to ${MAX_CHARS} characters`);

    const state = stateFor(text);
    const started = performance.now();
    // Both questions are answered in one parallel pass. One retry at most:
    // while someone is typing, a late answer is already stale.
    const response = await jev.systemOne(
      { model: MODEL, state, questions },
      { timeout: 5_000, retry: { maxRetries: 1 } },
    );
    return {
      request: { model: MODEL, state, questions },
      response,
      latency_ms: Math.round(performance.now() - started),
    };
  },
} satisfies Routes;
