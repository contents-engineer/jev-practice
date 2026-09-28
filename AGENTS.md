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

- 감정 id는 `projects/emotion-face/server.ts`의 choice criteria 키에서 나온다(`EmotionId`). id를 바꾸면 `emotions.ts`의 `EMOTIONS`(id마다 색, 한국어 이름, 표정 프리셋)와 `main.ts`의 `SAMPLES`를 함께 맞춘다.
- 표정 프리셋의 키는 ARKit blendshape 이름이고(`ARKIT_BLENDSHAPES`, facecap.glb와 같은 순서), 값은 강도 1일 때의 가중치다.
- Jev 질문을 설계하거나 고칠 때는 `.agents/skills/typesafe-ai/SKILL.md`와 live 문서(https://docs.typesafe.ai/llms.txt)를 따른다. criteria는 영어로 쓰고, 헷갈리는 이웃 감정과의 경계는 `what`/`not_for`에 적는다. 바꾼 뒤에는 실제 Jev 호출로 `SAMPLES`의 문장마다 의도한 감정이 나오는지 확인한다.
- 입력 루프: 요청은 한 번에 하나만 보내고, 첫 키 입력 후 90ms 동안의 입력을 묶는다(타이머는 묶음마다 한 번만 건다). 그래서 빠르게 타이핑하는 중에도 요청이 이어진다. `generation`이 바뀐 뒤 도착한 답은 버린다.

## 검증

- 매번: `npm run typecheck`, `npm run build`.
- API를 바꿨으면: dev 서버에 `curl -X POST localhost:5173/api/<name>/<route> -H 'Content-Type: application/json' -d '{...}'`를 보내 정상 응답과 400/405를 확인한다.
- 화면을 바꿨으면: 브라우저에서 샘플 칩을 눌러 패널 값과 표정을 직접 본다. 편집 도중 열려 있던 탭이 HMR 중간 상태로 매 프레임 에러를 내면, dev 서버가 그 로그에 막혀 응답하지 않는다. 그러면 탭을 새로 고치거나 dev 서버를 재시작한다.
