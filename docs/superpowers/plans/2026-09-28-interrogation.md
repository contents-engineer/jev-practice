# 취조실 (interrogation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/interrogation/` 페이지: 형사의 한국어 발화를 Jev가 7개 판단으로 읽고, 코드가 용의자의 미터·대사·얼굴을 움직여 12턴 안에 자백을 받아내는 게임.

**Architecture:** 게임 로직(`engine.ts`)은 브라우저에서 도는 순수 함수, Jev 호출은 서버 라우트(`server.ts` → `api/interrogation/turn.ts`)가 사건 데이터(`cases.ts`)로 state·질문을 만들어 한 번에 7개 질문을 묻는다. 용의자 대사는 생성하지 않고 사건 데이터에서 선택한다. 얼굴은 `projects/emotion-face/face.ts`의 `Face`를 재사용한다.

**Tech Stack:** Vite 8 MPA, TypeScript 7, `@typesafe-ai/sdk` 0.6, three.js(기존 얼굴), node:test.

## Global Constraints

- 서버에서 실행되는 파일(`api/`, `server/`, `projects/*/server.ts`, 그리고 `server.ts`가 import하는 `cases.ts`)의 상대 import에는 `.ts`를 붙인다. 브라우저 코드는 확장자 없이 쓴다.
- API 키 이름은 `TYPESAFE_AI_API`. `serve()`가 처리하며 브라우저는 `/api/...`만 부른다.
- 화면 문구는 한국어. Jev 응답 필드 라벨에는 `<code>` 병기. criteria와 state는 영어, examples는 한국어.
- 글꼴 스택·`word-break: keep-all`·제목 `<span>` 분할·`is-live` 규약은 emotion-face와 같다.
- 스타일시트는 `index.html`의 `<link>`로 건다.
- **커밋하지 않는다**(사용자 규칙). 마지막에 관련 파일만 `git add` 하고 커밋 메시지를 제안한다.
- 매번 `npm test`, `npm run typecheck`, `npm run build`.
- 기대값(평가 JSON)은 실행 전에 확정하고 결과에 맞춰 바꾸지 않는다.

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `projects/interrogation/cases.ts` | 타입(`Move`, `Tier`, `Topic`, `Evidence`, `CaseFile`), 사건 3개, 일반 대사 풀, move 메타(한글 이름·이모지) |
| `projects/interrogation/engine.ts` | `newGame`, `tierOf`, `applyTurn`, `gradeOf`, `shareText` (순수) |
| `projects/interrogation/server.ts` | `stateFor`, `questionsFor`, `toReading`, `readTurn` (Jev) |
| `projects/interrogation/director.ts` | tier·이벤트 → `Mood` |
| `projects/interrogation/main.ts` | 화면 흐름 |
| `projects/interrogation/index.html`, `style.css` | 마크업·스타일 |
| `api/interrogation/turn.ts` | `export default serve(readTurn)` |
| `tests/interrogation.test.mjs` | 엔진·서버 검증 회귀 테스트 |
| `evals/interrogation-cases.json`, `scripts/evaluate-interrogation.mjs` | 실제 Jev 판독 평가 |
| `README.md`, `AGENTS.md` | 문서 |

---

### Task 1: 사건 데이터 타입과 사건 1

**Files:**
- Create: `projects/interrogation/cases.ts`
- Test: `tests/interrogation.test.mjs` (데이터 무결성 테스트)

**Interfaces (Produces):**

```ts
export type Move = 'rapport' | 'open_question' | 'probe' | 'present_evidence' | 'bluff' | 'accuse' | 'threaten' | 'minimize' | 'off_topic' | 'unclear';
export const MOVES: readonly Move[];
export type Tier = 'calm' | 'open' | 'nervous' | 'defensive' | 'shaken' | 'broken';
export interface Topic { id; name_ko; name_en; about; examples: string[]; statement; statement_en; pressed: Partial<Record<Tier, string[]>> }
export interface Evidence { id; name_ko; name_en; shows; detail_ko; examples: string[]; breaks: string | null; crack; adapt; adapted_statement_en?; repeat; deflect? }
export interface CaseFile { id; title; difficulty; tagline; brief_ko: string[]; summary_en; suspect: { name_ko; name_en; age; job_ko; description_en; tint; opening }; personality: { pressureGain; guardGain; trustGain }; start: { pressure; trust; guard }; cracksNeeded; maxTurns; topics: Topic[]; evidence: Evidence[]; tips?: string[]; endings: { confession: string[]; tainted: string[]; lawyer: string; timeout: string } }
export const CASES: readonly CaseFile[];
export function caseById(id: string): CaseFile | undefined;
export const GENERIC_LINES: Record<Move, Partial<Record<Tier, string[]>>>;
export const MOVE_META: Record<Move, { ko: string; emoji: string }>;
```

- [ ] **Step 1: 무결성 테스트 작성** — 모든 사건에서 `evidence.breaks`가 topic id이거나 null, 각 topic에 깨는 증거가 1개 이상, `cracksNeeded ≤ 깨는 증거가 있는 topic 수`, red herring 1개 이상, `GENERIC_LINES`에 모든 move의 `calm` 줄이 있음.

```js
test('case files are internally consistent', async () => {
  for (const file of CASES) {
    const topicIds = new Set(file.topics.map(t => t.id));
    for (const e of file.evidence) assert.ok(e.breaks === null || topicIds.has(e.breaks), `${file.id}: ${e.id}`);
    const breakable = file.topics.filter(t => file.evidence.some(e => e.breaks === t.id));
    assert.ok(file.cracksNeeded <= breakable.length);
    assert.ok(file.evidence.some(e => e.breaks === null && e.deflect));
    assert.ok(file.maxTurns >= 8);
  }
  for (const move of MOVES) assert.ok(GENERIC_LINES[move].calm?.length, move);
});
```

- [ ] **Step 2: 실패 확인** `npm test` → cases.ts 없음으로 실패.
- [ ] **Step 3: cases.ts 작성** — 타입, `MOVES`, `MOVE_META`, `GENERIC_LINES`(move × tier 2~3줄), 사건 1 「새벽 2시의 편의점」(spec 4절). 사건 2·3은 Task 6에서 추가.
- [ ] **Step 4: 통과 확인** `npm test`.

### Task 2: 엔진

**Files:**
- Create: `projects/interrogation/engine.ts`
- Test: `tests/interrogation.test.mjs`

**Interfaces (Produces):**

```ts
export interface Meters { pressure: number; trust: number; guard: number }
export interface Reading { move: Move; moveConfidence: number; moveProbabilities: Record<Move, number>; topic: string; evidence: string; hostility: number; hostilityLevel: 0 | 1 | 2 | 3; empathy: number; falsePromise: number; expectsAnswer: number }
export type EventKind = 'statement' | 'pressed' | 'crack' | 'adapt' | 'repeat' | 'deflect' | 'no_evidence' | 'bluff_called' | 'bluff_worked' | 'coerced' | 'false_promise' | 'generic';
export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export interface Ending { kind: 'confession' | 'tainted' | 'lawyer' | 'timeout'; route: 'breakdown' | 'opening' | null; grade: Grade }
export interface TurnRecord { turn: number; text: string; reading: Reading; events: EventKind[]; before: Meters; after: Meters; reply: string; tier: Tier }
export interface GameState { caseId; turn; meters: Meters; committed: string[]; adapted: string[]; cracked: string[]; presented: string[]; moveCounts: Partial<Record<Move, number>>; tainted: null | 'threat' | 'false_promise'; bluffCalled: number; abusive: number; log: TurnRecord[]; ending: Ending | null }
export function newGame(file: CaseFile): GameState;
export function tierOf(m: Meters): Tier;
export function applyTurn(state: GameState, file: CaseFile, text: string, reading: Reading): GameState; // 새 객체
export function gradeOf(state: GameState, file: CaseFile): Grade;
export function shareText(state: GameState, file: CaseFile, url: string): string;
export function readingOf(partial: Partial<Reading> & { move: Move }): Reading; // 테스트·기본값 헬퍼
```

- [ ] **Step 1: 테스트 작성** (헬퍼 `r = (move, extra) => readingOf({ move, ...extra })`, 사건 1 사용)
  - 진술 후 증거 → `crack`, cracked에 증거 id, 압박 +22×gain
  - 진술 전 증거 → `adapt`, adapted에 증거 id, committed에 topic 추가, crack 없음
  - 같은 증거 재제시 → `repeat`, 미터 변화 압박 +2 이하
  - 무관 증거 → `deflect`
  - `present_evidence` + `none` → `no_evidence`
  - `bluff`: 침착할 때 `bluff_called`(신뢰 −15), 흔들릴 때 `bluff_worked`
  - `accuse` 3회째 압박 이득 절반
  - `threaten`을 방어 100까지 → `ending.kind === 'lawyer'`
  - 적대성 3 → `tainted === 'threat'`; 이후 자백 조건 충족 → `ending.kind === 'tainted'`, grade F
  - `off_topic` → 미터 그대로, turn +1
  - 12턴 소진 → `timeout`
  - 무너뜨리기 루트: 2진술 + 2모순 + 압박 ≥ 75 → confession/breakdown
  - 마음 열기 루트: 신뢰 ≥ 70, 모순 1, 압박 ≥ 35, `minimize` → confession/opening
  - `gradeOf`: 6턴 S, 8턴 A, bluffCalled면 한 단계 하락
  - `shareText`에 사건 제목·턴·이모지 포함
- [ ] **Step 2: 실패 확인** — `engine.ts` 없음.
- [ ] **Step 3: engine.ts 작성** — spec 2절의 표를 그대로 코드로. 핵심 흐름:

```ts
export function applyTurn(state, file, text, reading) {
  if (state.ending) return state;
  const s = clone(state); const events = []; const before = { ...s.meters };
  const d = { pressure: 0, trust: 0, guard: 0 };
  const count = (s.moveCounts[reading.move] = (s.moveCounts[reading.move] ?? 0) + 1);
  const diminish = count >= 3 ? 0.5 : 1;
  const ev = file.evidence.find(e => e.id === reading.evidence);
  const topic = file.topics.find(t => t.id === reading.topic);
  let reply: string | undefined;
  const evidencePath = ev && !['off_topic', 'unclear', 'bluff'].includes(reading.move);
  if (evidencePath) { /* presented? repeat : breaks===null ? deflect : committed.includes(breaks) && !cracked-by-this ? crack : adapt */ }
  else if (reading.move === 'present_evidence') { events.push('no_evidence'); d.pressure += 3; }
  else if ((reading.move === 'open_question' || reading.move === 'probe') && topic) { /* committed? pressed : statement */ }
  else switch (reading.move) { /* spec 표 */ }
  // 수정자 → 계수 → clamp → tier → reply 기본값(GENERIC_LINES) → 엔딩 검사 → log
}
```

  - 대사 변형 선택은 `lines[(s.log.length) % lines.length]`로 결정적.
  - `tierOf`: guard ≥ 60 defensive, pressure ≥ 65 shaken, ≥ 30 nervous, trust ≥ 55 open, else calm.
- [ ] **Step 4: 통과 확인** `npm test`.

### Task 3: 서버 라우트와 Jev 질문

**Files:**
- Create: `projects/interrogation/server.ts`, `api/interrogation/turn.ts`
- Test: `tests/interrogation.test.mjs`

**Interfaces (Produces):**

```ts
export const MAX_CHARS = 200;
export function stateFor(file: CaseFile, text: string, committed: string[], adapted: string[]): State;
export function questionsFor(file: CaseFile): { move: ChoiceQuestion; topic: ChoiceQuestion; evidence: ChoiceQuestion; hostility: ScoreQuestion; empathy: NoulQuestion; false_promise: NoulQuestion; expects_answer: NoulQuestion };
export function toReading(answers): Reading;  // hostilityLevel = P(3) ≥ 0.5 ? 3 : round(score)
export interface TurnReading { reading: Reading; request: { model; state; questions }; response; latency_ms: number }
export async function readTurn(body: unknown, jev: TypeSafeClient): Promise<TurnReading>;
```

- [ ] **Step 1: 테스트 작성** — mock `jev.systemOne`가 고정 answers를 돌려줄 때: 잘못된 본문(null, `{}`, 빈 text, 모르는 caseId, committed가 배열 아님) → 400, 201자 → 413, Jev 미호출. 정상 요청: 질문 키 7개, `state.case.suspect_statements_so_far`에 committed topic의 영어 진술, adapted 증거가 있으면 그 `adapted_statement_en`, `reading.hostilityLevel`이 확률로 결정됨.
- [ ] **Step 2: 실패 확인.**
- [ ] **Step 3: server.ts 작성** — spec 3절의 state·질문. `move` criteria는 `what`/`not_for`/`examples`(한국어), `topic`·`evidence` criteria는 사건 데이터로 생성(`none` 포함), `hostility` 4단계 `what`/`examples`, noul 3개는 `true`/`false` criteria. `RequestBudget` 별도 인스턴스. 호출 옵션 `{ timeout: 5_000, retry: { maxRetries: 1 } }`.
- [ ] **Step 4: api/interrogation/turn.ts** — `export default serve(readTurn)`.
- [ ] **Step 5: 통과 확인** + dev 서버에 curl로 정상/400/405/413.

### Task 4: 얼굴 감독과 페이지 뼈대

**Files:**
- Create: `projects/interrogation/director.ts`, `index.html`, `style.css`, `main.ts`

- [ ] **Step 1: director.ts** — `moodForTier(tier): Mood`, `flashForEvents(events): Mood | null` (crack → surprised 0.9, bluff_called → contempt 0.7, adapt → fear 0.5, statement → neutral). `NEUTRAL` 기반으로 mix 생성.
- [ ] **Step 2: index.html** — 시작 화면(사건 카드 `<template>`), 취조 화면(무대 canvas, 미터, 대화 `<ol>`, 입력 form, 사건 파일 aside, 판독 aside), 엔딩 dialog. 판독 패널 라벨에 `<code>` 병기.
- [ ] **Step 3: style.css** — emotion-face 토큰 재사용, 3열 그리드(≥1024px), 모바일 스택 + 탭, 심전도 SVG, 말풍선, 판독 칩·배지, 엔딩 오버레이, `html:not(.is-live)` 숨김.
- [ ] **Step 4: main.ts** — 흐름: 시작 → `newGame` → 턴 루프(입력 → fetch `/api/interrogation/turn` → `applyTurn` → 렌더: 형사 말풍선+판독 칩, 용의자 타자 효과, 미터 애니메이션, 수첩·증거 상태, 얼굴 mood/flash, 판독 패널) → 엔딩(등급·자백문·공유 복사·다시/다음). 요청 중 입력 비활성. 실패 시 턴 소모 없이 재시도 안내. `localStorage`에 최고 등급.
- [ ] **Step 5: `npm run typecheck && npm run build`**, playwriter로 사건 1을 실제 플레이해 자백까지 확인, 390px 폭 확인.

### Task 5: 평가 도구

**Files:**
- Create: `evals/interrogation-cases.json`, `scripts/evaluate-interrogation.mjs`
- Modify: `package.json` (`eval:interrogation`)

- [ ] **Step 1: 평가 JSON** — 사건별 발화 약 30개. 항목: `{ id, caseId, text, committed, moves: [허용 move], topic, evidence, hostility: [min,max], empathy?: 'high'|'low', falsePromise?: 'high'|'low' }`. 느낌표만, 협박, 거짓 약속, 허세, 증거 이름 직접 언급, 증거 내용만 언급, 열린 질문, 좁은 질문, 공감, 최소화, 무관한 말, 영어 문장 포함.
- [ ] **Step 2: 스크립트** — `scripts/evaluate-emotion.mjs`와 같은 구조. 판정: move ∈ moves, topic 일치, evidence 일치, hostility 범위, noul 임계 0.6. 보고서 `evals/reports/interrogation-latest.json`. 실패 시 종료 코드 1.
- [ ] **Step 3: 실행** (`npm run eval:interrogation`, 과금) — 결과를 README에 기록. 불일치는 질문 문구를 고칠 근거로만 쓰고 기대값은 바꾸지 않는다. 문구를 고쳤으면 다시 실행.

### Task 6: 사건 2·3

**Files:**
- Modify: `projects/interrogation/cases.ts`

- [ ] **Step 1: 「11번 국도 뺑소니」, 「보험금」 작성** (spec 4절). 무결성 테스트가 자동으로 검사한다.
- [ ] **Step 2: 평가 JSON에 두 사건의 발화 추가 후 재평가.**
- [ ] **Step 3: 두 사건도 브라우저로 한 번씩 플레이.**

### Task 7: 문서

**Files:**
- Modify: `README.md`, `AGENTS.md`

- [ ] **Step 1: README** — 실습 목록에 취조실 추가, 게임 규칙·판독 7개·API·평가 결과·알려진 한계(얼굴 하나, 한국어 정확도).
- [ ] **Step 2: AGENTS.md** — 취조실 섹션: 사건 데이터 규약(증거·화제·대사), 엔진 규칙 바꿀 때 테스트·평가, 강압 규칙의 의도.
- [ ] **Step 3: 최종 검증** `npm test && npm run typecheck && npm run build`, `git add` 후 커밋 메시지 제안.
