# AGENTS.md

TypeSafe AI Jev 실습 모음. Vite 8 멀티 페이지 + Vercel Functions. 개요와 실행법은 README.md.

## 구조 규약

- 페이지: `projects/<name>/index.html` 하나가 `/<name>/` 페이지 하나다. 빌드 입력과 허브 목록은 `server/projects.ts`가 폴더를 찾아 만들고, 허브 목록은 그 페이지의 `<title>`과 `<meta name="description">`을 읽는다.
- 서버 라우트: 로직은 `projects/<name>/server.ts`에 두고, `api/<name>/<route>.ts`에서 `export default serve(fn)`으로 연결한다. dev 서버(`server/dev-api.ts`)가 같은 파일을 실행하므로 로컬과 Vercel의 동작이 같다. 이렇게 하는 이유: Vite 미들웨어로만 만든 API는 Vercel 배포에 포함되지 않아 404가 났다.
- 비밀값: API 키 이름은 `TYPESAFE_AI_API`다(SDK 기본 이름인 `TYPESAFE_API_KEY`가 아니다). 서버에서 `process.env`로만 읽고(`serve()`가 처리), 브라우저 코드는 `/api/...`를 거쳐 Jev에 닿는다. 값은 로컬에서 `.env`, 배포에서 Vercel 환경변수에 둔다.

## Vercel이 서버 코드를 컴파일하는 방식

Vercel은 이 저장소의 `tsc`(TypeScript 7)로 `api/` 진입점과 그 import를 컴파일한다. 이때 쓰는 임시 설정은 `tsconfig.json`을 extends하고 `noEmit: false`, `rewriteRelativeImportExtensions: true`를 켜며, 임시 폴더에 놓인다. 그래서:

- 서버에서 실행되는 파일(`api/`, `server/`, `projects/*/server.ts`)의 상대 import에는 `.ts`를 붙인다. 브라우저 코드는 Vite가 번들하므로 확장자 없이 쓴다.
- 타입 참조는 `projects/vite-env.d.ts`의 `/// <reference>`로 둔다. `tsconfig.json`의 `types` 배열은 임시 설정 위치에서 해석되지 않아 빌드 로그에 TS2688이 찍힌다.

## 페이지 규약

- 화면 문구는 한국어로 쓴다. Jev 응답 필드에 대응하는 라벨에는 필드 이름을 `<code>`로 병기한다(예: `감정 <code>emotion</code>`). Jev criteria와 state는 정확도가 가장 높은 영어로 둔다.
- 글꼴 스택은 Latin 글꼴(Fraunces, Hanken Grotesk, Martian Mono) 뒤에 한글 글꼴(Hahmlet, Pretendard)을 잇는다. 한글 강조는 색과 굵기로 하고(한글 이탤릭은 없다), 한글 라벨의 자간은 0~0.02em으로 둔다. 줄바꿈은 `word-break: keep-all`, 제목은 의미 단위 `<span>`(inline-block)으로 나눈다.
- 스타일시트는 페이지 `index.html`의 `<head>`에서 `<link>`로 건다. JS에서 import한 CSS는 dev에서 three.js까지 모두 로드된 뒤에야 적용되고, 그전까지는 스타일 없는 화면이 보인다.
- 스크립트로 만드는 UI는 다 만든 뒤 `<html>`에 `is-live`를 붙여 드러낸다(`style.css`의 `html:not(.is-live)` 규칙).

## 반응하는 얼굴 (emotion-face)

- 감정 id는 `projects/emotion-face/server.ts`의 choice criteria 키에서 나온다(`EmotionId`). 감정 8종과 판단 불가 결과 `unclear`를 구분한다. id를 바꾸면 `emotions.ts`의 `EMOTIONS`·`EMOTION_IDS`, `samples.ts`의 예시와 평가 데이터를 함께 맞춘다.
- 표정 프리셋의 키는 ARKit blendshape 이름이고(`ARKIT_BLENDSHAPES`, facecap.glb와 같은 순서), 값은 강도 1일 때의 가중치다.
- Jev 질문을 설계하거나 고칠 때는 `.agents/skills/typesafe-ai/SKILL.md`와 live 문서(https://docs.typesafe.ai/llms.txt)를 따른다. criteria는 영어로 쓰고, 헷갈리는 이웃 감정과의 경계는 `what`/`not_for`에 적는다. 같은 요청의 질문은 독립적이므로 다른 답을 가리키는 “that emotion” 같은 표현은 쓰지 않는다. 강도는 전반적인 감정 반응을 묻는다. 실제 관계·이전 대화가 없으면 만들어 내지 않도록 한다.
- `neutral`은 이해 가능한 무감정 반응, `unclear`는 맥락 부족·미완성·상충하는 해석이다. `unclear`일 때 표정과 강도 요약·막대에는 강도를 적용하지 않고 원본 응답은 보존한다. 낮은 confidence의 임의 임계값을 정확도 검증 없이 추가하지 않는다.
- Choice 확률의 제곱·정규화는 표정 연출이다. 실제 복합 감정 비율로 설명하지 않는다. 복합 감정 측정 기능을 만들 경우 감정별 독립 Score와 별도 평가가 필요하다.
- 입력 루프는 `reading-loop.ts`에서 관리한다. 한 번에 요청 하나, 400ms 디바운스(입력 시 타이머 리셋), 대기 중 최신 입력 하나만 유지한다. 모든 정규화된 텍스트 변경마다 revision을 올리고 이전 응답·오류를 버린다. 뒤에 부정 표현을 붙인 경우와 비웠다가 같은 문장을 다시 쓴 경우도 예외가 아니다. 입력이 계속 바뀌면 표정 적용이 기다릴 수 있다. 새 입력에서는 얼굴을 기본 자세로 두고, 패널의 마지막 결과는 분석한 문장·이전 결과 안내와 함께 표시한다.
- 지연 시간: `latency_ms`는 서버 SDK 구간(재시도 포함), 브라우저의 입력→결과 수신은 대기·HTTP·파싱 포함이다. 렌더링 완료 시간으로 설명하지 않는다. 강도 단계 요약은 반올림 기대값, 막대 강조는 최대 확률 단계다.
- 모델은 서버 `TYPESAFE_MODEL`로 고정할 수 있고 기본값은 `jev-latest`다. 모델/질문 변경 시 평가 보고서의 실제 버전·질문과 결과를 함께 비교한다.
- `server/budget.ts`는 서버 인스턴스별 동시 4개·분당 120개·UTC 일일 2,000개 한도다. 실패한 허용 요청도 집계한다. 메모리 한도를 Vercel 전체의 분산 한도나 금액 상한으로 설명하지 않는다. 브라우저 15초, SDK 시도당 5초·재시도 1회 제한을 유지한다.

## 취조실 (interrogation)

- 게임 로직은 `projects/interrogation/engine.ts`의 순수 함수(`applyTurn`)에만 둔다. 미터 수치·자백 조건·등급을 바꾸면 `tests/interrogation.test.mjs`의 규칙 테스트와 README의 효과 표를 함께 고친다. 브라우저는 상태를 들고 있고 서버는 무상태다.
- Jev 질문 7개는 `server.ts`의 `questionsFor()`가 사건 데이터로 만든다. 행동(`move`) 기준의 `not_for`에 이웃 행동과의 경계를 적고, 예시는 한국어로 둔다. 화제·증거 선택지는 `cases.ts`의 `examples`에서 나오므로 사건을 추가하면 예시도 같이 쓴다.
- **증거 id는 `move === 'present_evidence'`일 때만 소비한다.** Jev는 화제를 묻는 말에도 관련 증거 id를 고르므로, 행동으로 가리지 않으면 진술 전 증거 제시로 오판돼 "진술 먼저, 증거 나중" 루프가 깨진다. 판독 칩도 같은 규칙으로 증거를 표시한다.
- 사건 데이터 규약(`CaseFile`): 화제마다 `statement`(첫 진술, 거짓말)와 `statement_en`(state용), 증거마다 `breaks`(관련 화제 id 또는 null), `contradicts`(실제로 깨는 현재 진술 id 목록), `crack`·`adapt`·`repeat` 대사, 무관한 증거는 `deflect`. `statements[topicId]`는 현재 진술 id(`initial`, `adapt:<evidenceId>`, `crack:<evidenceId>`)다. `statementFor()`로 대사·수첩·서버 state를 함께 조회한다. `adapted_statement_en`·`cracked_statement_en`과 각 `*_pressed` 대사를 함께 유지한다. `cracked`는 증거 이력이고 자백 진행도는 `crackedTopics()`의 서로 다른 화제 수다. 같은 화제의 추가 증거·양립하는 증거는 압박 +2의 보강이며 새 모순으로 세지 않는다. `cracksNeeded`는 깨는 증거가 있는 화제 수를 넘지 않는다. 무결성 테스트가 이 규약을 검사한다.
- 자백은 **마무리 행동**으로만 나온다. 모순이 채워지고 압박이 `BREAK_PRESSURE`(75)를 넘으면 `breaking` 상태(대사·표정·수사 메모로 신호)이고, `CLOSERS`(자백 요구·추궁·위협·최소화·라포), 마지막 모순, 통한 허세만 자백을 끌어낸다. 질문·무관한 말로 자백이 나오게 바꾸지 않는다. 마음 열기 경로는 라포·최소화가 마무리다. 두 경로 모두 행동 전 또는 후에 준비 조건을 만족하면 마무리할 수 있어 라포의 압박 감소로 기회를 잃지 않는다. 방어 100의 변호사 요청은 자백보다 우선한다.
- 강압 규칙(적대성 3단계·거짓 약속 → 자백 무효)은 「!!!」로 자백을 받아내던 원작 게임을 뒤집는 핵심이다. 임계값(`hostilityLevel` 3 판정에 3단계 확률 0.5, noul 0.6)을 완화하려면 평가 결과로 근거를 남긴다.
- 용의자 대사는 생성하지 않고 `cases.ts`에서 고른다(엔딩 → 증거 경로 → 화제 경로 → 일반 대사 순). 새 대사는 tier별 배열에 추가하고, 없는 tier는 `calm`으로 대체된다.
- 얼굴은 `../emotion-face/face`와 `../emotion-face/emotions`를 import해 재사용하고, `director.ts`가 tier·이벤트를 Mood로 바꾼다. 감정 프리셋을 바꾸면 두 페이지에 모두 영향이 있다.
- 질문·사건·엔진을 바꿨으면 dev 서버를 켜고 `npm run eval:interrogation`(과금)으로 `evals/interrogation-cases.json`을 다시 돌린다. 기대값은 실행 전에 정하고 결과에 맞춰 바꾸지 않는다. 브라우저에서는 사건 1을 진술 → 증거 순서로 플레이해 모순·자백까지 본다. 보고서는 `evals/reports/interrogation-latest.json`(Git 제외).

## 검증

- 매번: `npm test`, `npm run typecheck`, `npm run build`.
- 질문·선택지·모델을 바꿨으면: dev 서버 실행 후 `npm run eval:emotion`(반응하는 얼굴) 또는 `npm run eval:interrogation`(취조실)으로 `samples.ts`의 모든 예시와 `evals/emotion-cases.json`의 별도 문장을 실제 Jev로 평가한다(과금). 보고서는 `evals/reports/latest.json`에 저장되고 Git에서 제외된다. 불일치·서비스 실패는 종료 코드 1로 구분해 기록한다. 기대값은 미리 정하며, 결과를 맞추기 위해 사후 변경하지 않는다. 작은 회귀 세트 통과를 일반 정확도로 주장하지 않는다.
- API를 바꿨으면: dev 서버에 `curl -X POST localhost:5173/api/<name>/<route> -H 'Content-Type: application/json' -d '{...}'`를 보내 정상 응답과 400/405를 확인한다.
- 화면을 바꿨으면: 브라우저에서 샘플 칩을 눌러 패널 값과 표정을 직접 본다. 편집 도중 열려 있던 탭이 HMR 중간 상태로 매 프레임 에러를 내면, dev 서버가 그 로그에 막혀 응답하지 않는다. 그러면 탭을 새로 고치거나 dev 서버를 재시작한다.
