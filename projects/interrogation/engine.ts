// The game itself: pure functions over a GameState. Jev's reading of one utterance comes in,
// the suspect's meters, reply and composure come out. Nothing here talks to the network.
import { GENERIC_LINES, MOVE_META, MOVES, type CaseFile, type Move, type Tier } from './cases';
import type { Reading } from './server';

export type { Reading };

export interface Meters {
  pressure: number;
  trust: number;
  guard: number;
}

export type EventKind =
  | 'statement'
  | 'pressed'
  | 'crack'
  | 'adapt'
  | 'repeat'
  | 'deflect'
  | 'no_evidence'
  | 'bluff_called'
  | 'bluff_worked'
  | 'coerced'
  | 'false_promise'
  | 'breaking'
  | 'generic';

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface Ending {
  kind: 'confession' | 'tainted' | 'lawyer' | 'timeout';
  route: 'breakdown' | 'opening' | null;
  grade: Grade;
}

export interface TurnRecord {
  /** 1-based. */
  turn: number;
  text: string;
  reading: Reading;
  events: EventKind[];
  before: Meters;
  after: Meters;
  reply: string;
  tier: Tier;
}

export interface GameState {
  caseId: string;
  /** Turns used. */
  turn: number;
  meters: Meters;
  /** Topics the suspect has given an account of, in order. */
  committed: string[];
  /** Evidence ids the story bent around (presented before a statement). */
  adapted: string[];
  /** Evidence ids that caught a contradiction. */
  cracked: string[];
  /** Every evidence id presented so far. */
  presented: string[];
  moveCounts: Partial<Record<Move, number>>;
  tainted: null | 'threat' | 'false_promise';
  bluffCalled: number;
  abusive: number;
  log: TurnRecord[];
  ending: Ending | null;
}

export const EVENT_META: Record<EventKind, { ko: string; badge?: boolean }> = {
  statement: { ko: '진술 확보' },
  pressed: { ko: '재질문' },
  crack: { ko: '모순!', badge: true },
  adapt: { ko: '이야기를 바꿈', badge: true },
  repeat: { ko: '이미 제시한 증거' },
  deflect: { ko: '무관한 증거' },
  no_evidence: { ko: '증거 없이' },
  bluff_called: { ko: '허세 들통', badge: true },
  bluff_worked: { ko: '허세 통함', badge: true },
  coerced: { ko: '강압', badge: true },
  false_promise: { ko: '거짓 약속', badge: true },
  breaking: { ko: '무너지기 직전', badge: true },
  generic: { ko: '' },
};

const THRESHOLD = { empathy: 0.6, falsePromise: 0.6 };
/** Pressure at which a suspect whose story is broken can be made to confess. */
export const BREAK_PRESSURE = 75;
/** Moves that ask for the confession or offer a way out; the only ones that end a breakable suspect. */
const CLOSERS: readonly Move[] = ['demand', 'accuse', 'threaten', 'minimize', 'rapport'];

export function newGame(file: CaseFile): GameState {
  return {
    caseId: file.id,
    turn: 0,
    meters: { ...file.start },
    committed: [],
    adapted: [],
    cracked: [],
    presented: [],
    moveCounts: {},
    tainted: null,
    bluffCalled: 0,
    abusive: 0,
    log: [],
    ending: null,
  };
}

/** A complete Reading from a partial one; tests and fallbacks use it. */
export function readingOf(partial: Partial<Reading> & { move: Move }): Reading {
  const probabilities = Object.fromEntries(MOVES.map((m) => [m, m === partial.move ? 1 : 0])) as Record<Move, number>;
  return {
    moveConfidence: 1,
    moveProbabilities: probabilities,
    topic: 'none',
    evidence: 'none',
    hostility: 0,
    hostilityLevel: 0,
    empathy: 0,
    falsePromise: 0,
    expectsAnswer: 0,
    ...partial,
  };
}

/** Story broken and pressure high: the suspect will confess to a closing move, and only to one. */
export function isBreaking(state: GameState, file: CaseFile): boolean {
  return state.cracked.length >= file.cracksNeeded && state.meters.pressure >= BREAK_PRESSURE;
}

export function tierOf(m: Meters, breaking = false): Tier {
  if (breaking) return 'breaking';
  if (m.guard >= 60) return 'defensive';
  if (m.pressure >= 65) return 'shaken';
  if (m.pressure >= 30) return 'nervous';
  if (m.trust >= 55) return 'open';
  return 'calm';
}

const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v)));

function linesFor(move: Move, tier: Tier): string[] {
  const lines = GENERIC_LINES[move];
  return lines[tier] ?? (tier === 'breaking' ? lines.shaken : undefined) ?? lines.calm ?? ['…'];
}

/** One turn: the detective said `text`, Jev read it as `reading`. Returns a new state. */
export function applyTurn(state: GameState, file: CaseFile, text: string, reading: Reading): GameState {
  if (state.ending) return state;
  const s: GameState = {
    ...state,
    meters: { ...state.meters },
    committed: [...state.committed],
    adapted: [...state.adapted],
    cracked: [...state.cracked],
    presented: [...state.presented],
    moveCounts: { ...state.moveCounts },
    log: [...state.log],
  };
  const before = { ...state.meters };
  const wasBreaking = isBreaking(state, file);
  const events: EventKind[] = [];
  const d = { pressure: 0, trust: 0, guard: 0 };
  const pick = (lines: string[]) => lines[s.log.length % lines.length];
  const count = (s.moveCounts[reading.move] = (s.moveCounts[reading.move] ?? 0) + 1);
  const diminish = count >= 3 ? 0.5 : 1;
  const { move } = reading;
  const item = file.evidence.find((e) => e.id === reading.evidence);
  const topic = file.topics.find((t) => t.id === reading.topic);
  let reply: string | undefined;
  /** Which composure's lines to read when the reply is generic. */
  let replyTier: Tier | undefined;

  // The move says what the detective is doing; the evidence id is only read as its argument.
  // Jev names an item for any question that touches its subject, so a probe about the safe
  // is not a presentation of the safe's log.
  if (item && move === 'present_evidence') {
    if (s.presented.includes(item.id)) {
      events.push('repeat');
      d.pressure += 2;
      reply = item.repeat;
    } else if (item.breaks === null) {
      events.push('deflect');
      s.presented.push(item.id);
      d.pressure += 2;
      d.trust -= 2;
      reply = item.deflect;
    } else if (s.committed.includes(item.breaks)) {
      events.push('crack');
      s.presented.push(item.id);
      s.cracked.push(item.id);
      d.pressure += 22;
      d.guard -= 5;
      reply = item.crack;
    } else {
      // Shown the evidence first, the suspect bends the story around it: no contradiction to catch.
      events.push('adapt');
      s.presented.push(item.id);
      s.adapted.push(item.id);
      s.committed.push(item.breaks);
      d.pressure += 8;
      reply = item.adapt;
    }
  } else if (move === 'present_evidence') {
    events.push('no_evidence');
    d.pressure += 3;
  } else if ((move === 'open_question' || move === 'probe') && topic && !wasBreaking) {
    // Past the breaking point the suspect is done telling stories: questions get the tell instead.
    if (move === 'open_question') {
      d.trust += 4;
      d.pressure += 4;
    } else {
      d.pressure += 6;
      d.guard += 2;
    }
    if (s.committed.includes(topic.id)) {
      events.push('pressed');
      const tier = tierOf({ pressure: s.meters.pressure + d.pressure, trust: s.meters.trust + d.trust, guard: s.meters.guard + d.guard });
      const lines = topic.pressed[tier] ?? topic.pressed.shaken ?? topic.pressed.calm ?? [topic.statement];
      // Never say the same evasion twice in a row: fall through to the generic lines instead.
      const previous = s.log[s.log.length - 1]?.reply;
      reply = lines.find((line) => line !== previous) ?? pick(linesFor(move, tier));
    } else {
      events.push('statement');
      s.committed.push(topic.id);
      reply = topic.statement;
    }
  } else {
    switch (move) {
      case 'rapport':
        d.trust += 12;
        d.guard -= 8;
        d.pressure -= 3;
        break;
      case 'open_question':
        d.trust += 2;
        d.pressure += 2;
        break;
      case 'probe':
        d.pressure += 4;
        d.guard += 2;
        break;
      case 'bluff':
        if (s.meters.pressure >= 60 && s.meters.guard < 50) {
          events.push('bluff_worked');
          d.pressure += 10;
          replyTier = 'shaken';
        } else {
          events.push('bluff_called');
          s.bluffCalled++;
          d.trust -= 15;
          d.guard += 12;
          replyTier = s.meters.guard >= 60 ? 'defensive' : 'calm';
        }
        break;
      case 'accuse':
        d.pressure += 8 * diminish;
        d.guard += 10;
        d.trust -= 6;
        break;
      case 'demand':
        d.pressure += 8 * diminish;
        d.guard += 6;
        d.trust -= 4;
        break;
      case 'threaten':
        d.pressure += 10 * diminish;
        d.guard += 18;
        d.trust -= 15;
        break;
      case 'minimize':
        if (s.meters.trust >= 50) {
          d.pressure += 6;
          d.guard -= 10;
          d.trust += 4;
          replyTier = 'open';
        } else {
          d.guard += 6;
          d.trust -= 4;
        }
        break;
      case 'off_topic':
      case 'unclear':
        break;
    }
    if (events.length === 0) events.push('generic');
  }

  // Modifiers from the other readings, whatever the move.
  if (reading.hostilityLevel >= 3) {
    events.push('coerced');
    s.abusive++;
    s.tainted ??= 'threat';
    d.guard += 15;
  } else if (reading.hostilityLevel === 2) {
    s.abusive++;
    d.guard += 8;
    d.trust -= 8;
  }
  if (reading.empathy >= THRESHOLD.empathy) d.trust += 4;
  if (reading.falsePromise >= THRESHOLD.falsePromise) {
    events.push('false_promise');
    s.tainted ??= 'false_promise';
    d.trust += 8;
  }

  const { pressureGain, guardGain, trustGain } = file.personality;
  s.meters = {
    pressure: clamp(s.meters.pressure + d.pressure * pressureGain),
    trust: clamp(s.meters.trust + d.trust * trustGain),
    guard: clamp(s.meters.guard + d.guard * guardGain),
  };
  s.turn++;

  const breaking = isBreaking(s, file);
  let tier = tierOf(s.meters, breaking);
  // A receptive suspect hears minimization warmly, unless already shaken.
  const lineTier = move === 'minimize' && tier === 'shaken' ? 'shaken' : (replyTier ?? tier);
  reply ??= pick(linesFor(move, lineTier));

  // Endings, in order of precedence. A breakable suspect confesses only to a closing move:
  // a demand or a way out, the crack that completes the story, or a bluff that lands.
  const cracks = s.cracked.length;
  const soft = move === 'minimize' || move === 'rapport';
  const closer = CLOSERS.includes(move) || events.includes('crack') || events.includes('bluff_worked');
  let ending: Ending | null = null;
  if (s.meters.guard >= 100) {
    ending = { kind: 'lawyer', route: null, grade: 'E' };
    reply = file.endings.lawyer;
  } else if (breaking && closer) {
    ending = { kind: 'confession', route: 'breakdown', grade: 'C' };
  } else if (cracks >= file.cracksNeeded - 1 && s.meters.trust >= 70 && s.meters.pressure >= 35 && soft) {
    ending = { kind: 'confession', route: 'opening', grade: 'C' };
  } else if (s.turn >= file.maxTurns) {
    ending = { kind: 'timeout', route: null, grade: 'D' };
    reply = file.endings.timeout;
  }
  if (!ending && breaking) events.push('breaking');
  if (ending?.kind === 'confession') {
    tier = 'broken';
    if (s.tainted) {
      ending = { kind: 'tainted', route: ending.route, grade: 'F' };
      reply = file.endings.tainted.join('\n\n');
    } else {
      reply = file.endings.confession.join('\n\n');
    }
  }
  s.ending = ending;
  if (ending) s.ending = { ...ending, grade: gradeOf(s, file) };

  s.log.push({ turn: s.turn, text, reading, events, before, after: { ...s.meters }, reply, tier });
  return s;
}

const CONFESSION_GRADES: Grade[] = ['S', 'A', 'B', 'C'];

/** Turns a perfect interview needs: a statement and an item per required crack, plus the close. */
export function parOf(file: CaseFile): number {
  return file.cracksNeeded * 2 + 2;
}

export function gradeOf(state: GameState, file: CaseFile): Grade {
  const { ending } = state;
  if (!ending) return 'C';
  if (ending.kind === 'tainted') return 'F';
  if (ending.kind === 'lawyer') return 'E';
  if (ending.kind === 'timeout') return 'D';
  const over = state.turn - parOf(file);
  let index = over <= 0 ? 0 : over <= 2 ? 1 : over <= 4 ? 2 : 3;
  if (state.bluffCalled > 0 || state.abusive > 0) index++;
  return CONFESSION_GRADES[Math.min(index, CONFESSION_GRADES.length - 1)];
}

/** One line for the detective's notebook: what the state of the interview calls for now. */
export function hintFor(state: GameState, file: CaseFile): string {
  if (state.ending) return '';
  const { pressure, trust, guard } = state.meters;
  const cracks = state.cracked.length;
  if (isBreaking(state, file)) return '무너지기 직전입니다. 자백을 요구하거나(자백 요구·추궁) 빠져나갈 길을 주세요(최소화·라포). 질문은 자백을 내지 않습니다.';
  if (cracks >= file.cracksNeeded - 1 && trust >= 70 && pressure >= 35) return '마음이 열렸습니다. 이해할 만한 동기를 제시하거나(최소화) 다독이면(라포) 털어놓을 수 있습니다.';
  if (guard >= 75) return '방어가 높습니다. 이대로면 변호사를 부릅니다. 라포로 낮추세요.';
  if (cracks >= file.cracksNeeded) return `이야기가 무너졌습니다. 압박을 ${BREAK_PRESSURE} 위로 올리세요(자백 요구·추궁·증거). 위협은 방어만 키웁니다.`;
  if (state.committed.length === 0) return '먼저 진술을 받아내세요. 그날 일을 묻고, 세부를 좁히세요.';
  if (cracks === 0) return '진술을 깨는 증거를 이름 붙여 제시하세요. 진술 전에 꺼내면 이야기를 바꿉니다.';
  return `모순 ${file.cracksNeeded - cracks}개 더 필요합니다. 다른 화제의 진술을 받고 증거로 깨세요.`;
}

export const OUTCOME_KO: Record<Ending['kind'], string> = {
  confession: '자백 ✅',
  tainted: '자백 무효 ⛔',
  lawyer: '변호사 요청 🚪',
  timeout: '석방 ⏳',
};

/** Wordle-style summary: one emoji per turn, ⚡ after a contradiction. */
export function shareText(state: GameState, file: CaseFile, url: string): string {
  const outcome = state.ending ? OUTCOME_KO[state.ending.kind] : '진행 중';
  const trail = state.log.map((t) => MOVE_META[t.reading.move].emoji + (t.events.includes('crack') ? '⚡' : '')).join('');
  const grade = state.ending ? ` · 등급 ${state.ending.grade}` : '';
  return [
    `취조실 · 「${file.title}」`,
    `${outcome} ${state.turn}턴 · 모순 ${state.cracked.length}개 (필요 ${file.cracksNeeded})${grade}`,
    trail,
    url,
  ].join('\n');
}
