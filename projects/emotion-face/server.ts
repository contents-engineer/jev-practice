import { choice, score, type SystemOneResult, type TypeSafeClient } from '@typesafe-ai/sdk';
import { HttpError } from '../../server/api.ts';

const MODEL = 'jev-latest';
const MAX_CHARS = 2_000;

// Neutral plus Ekman's seven basic facial expressions, the set face models are built around.
// `what` / `not_for` sharpen the borders between neighbours Jev would otherwise blur
// (happy vs surprised, disgust vs contempt, ...).
export const questions = {
  emotion: choice('When the recipient reads this message, which one emotion would they most likely feel?', {
    neutral: {
      what: 'No real emotional reaction: routine, factual or ambiguous messages such as logistics, scheduling or small talk',
      not_for: 'Messages that carry a clear feeling, even a mild one',
    },
    happy: {
      what: 'Happiness, joy, delight, gratitude or relief; feeling loved, praised or supported',
      not_for: 'Being caught off guard before knowing whether news is good (surprised)',
    },
    sad: {
      what: 'Sadness, hurt, disappointment, loneliness, grief or regret: loss, rejection, bad news that already happened',
      not_for: 'Hostile blame that provokes the recipient (angry)',
    },
    angry: {
      what: 'Anger, irritation or frustration: feeling attacked, insulted, blamed, lied to or treated unfairly',
      not_for: 'Being hurt without hostility (sad)',
    },
    surprised: {
      what: 'Surprise or astonishment: being caught off guard by something unexpected, good or bad',
      not_for: 'Clear good news whose main effect is delight (happy)',
    },
    fear: {
      what: 'Fear, anxiety or worry: danger, threats, warnings, something bad that might happen',
      not_for: 'Being startled by something unexpected but harmless (surprised)',
    },
    disgust: {
      what: 'Disgust or revulsion: something gross, dirty, vile or physically repulsive',
      not_for: 'Looking down on the sender for their attitude or behavior (contempt)',
    },
    contempt: {
      what: 'Contempt or disdain toward the sender: smug bragging, arrogance, hypocrisy or behavior the recipient looks down on',
      not_for: 'Physical revulsion at something gross (disgust)',
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

/** Served at POST /api/emotion-face/emotion with `{ text }`: how the recipient would feel, and how strongly. */
export async function readEmotion(body: unknown, jev: TypeSafeClient): Promise<EmotionReading> {
  const text = (body as { text?: unknown } | null)?.text;
  if (typeof text !== 'string' || !text.trim()) throw new HttpError(400, '"text"에 메시지를 넣어 주세요');
  if (text.length > MAX_CHARS) throw new HttpError(413, `메시지는 ${MAX_CHARS.toLocaleString()}자까지 보낼 수 있습니다`);

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
}
