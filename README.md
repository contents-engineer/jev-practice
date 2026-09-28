# Jev 실험실 (Jev Lab)

TypeSafe AI의 System One 모델 **Jev**를 익히기 위한 실습 모음입니다.

첫 실습 **반응하는 얼굴**(`/emotion-face/`)은 메시지를 입력하는 동안 받는 사람이 느낄 감정(8종 중 하나)과 그 강도를 Jev로 판단하고, 그 결과를 3D 얼굴의 ARKit blendshape 52개에 실시간으로 적용합니다.

- 배포: https://jev-practice-delta.vercel.app
  - `/`: 실습 목록 (Jev 실험실)
  - `/emotion-face/`: 반응하는 얼굴
- 화면은 한국어 사용자를 기준으로 만들었습니다. Jev에 보내는 질문 기준(criteria)은 정확도가 가장 높은 영어로 둡니다.

## Jev 한눈에 보기

Jev는 글을 생성하지 않습니다. 상황(`state`)과 타입이 정해진 질문을 보내면, 질문마다 타입이 정해진 답과 확률을 한 번의 병렬 처리로 돌려줍니다. 흐름은 코드가 쥐고, 모델은 의미를 이해해야 하는 판단만 맡습니다.

| 질문 타입 | 돌려주는 값 | 이 프로젝트에서 |
| --- | --- | --- |
| `choice` | 고른 선택지, 선택지별 확률, confidence | `emotion`: 감정 8종 중 하나 |
| `score` | 단계별 확률과 그 기대값(`score`), confidence | `intensity`: 강도 0~4 |
| `noul` | 예일 확률 | 사용하지 않음 |

- `confidence`는 확률이 한 답에 얼마나 몰렸는지를 나타낼 뿐, 답이 맞다는 보증은 아닙니다.
- 이 프로젝트는 공식 JS SDK(`@typesafe-ai/sdk`)로 `POST https://api.typesafe.ai/v1/systemone`을 호출합니다. 모델은 `jev-latest`(현재 `jev-1.13.0`)입니다.
- 질문 두 개짜리 요청 한 번에 입력은 약 980토큰이고, 응답은 보통 0.2~0.5초 걸립니다. 요금은 입력 토큰 백만 개당 $0.042이고 출력은 무료입니다.
- 공식 문서 기준으로 정확도는 영어가 가장 높습니다. 한국어 예시 문장 8개는 모두 의도한 감정으로 나왔지만, 입력 중인 짧은 한국어는 영어보다 덜 중립적으로 판단되는 경향이 있습니다.
- 자세한 내용은 [TypeSafe 문서](https://docs.typesafe.ai/llms.txt)를 참고하세요.

## 시작하기

Node.js 20.19 이상(또는 22.12 이상)이 필요합니다.

1. `npm install`
2. 프로젝트 루트의 `.env`에 API 키를 넣습니다. `.env`는 커밋되지 않습니다.

   ```
   TYPESAFE_AI_API=<TypeSafe API 키>
   ```

3. `npm run dev`를 실행하고 http://localhost:5173 을 엽니다.

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 페이지와 `api/` 함수를 함께 띄우는 개발 서버 |
| `npm run build` | `dist/`에 정적 빌드 |
| `npm run preview` | 빌드 결과 미리보기 (정적 파일만, API는 없음) |
| `npm run typecheck` | TypeScript 타입 검사 |

## 배포 (Vercel)

- `main`에 푸시하면 Vercel이 빌드하고 배포합니다. 페이지는 `dist/`의 정적 파일로, `api/` 폴더의 파일은 Vercel Function으로 올라갑니다.
- Vercel 프로젝트의 Settings → Environment Variables에 `TYPESAFE_AI_API`를 넣어야 API가 동작합니다. 없으면 API가 500과 안내 메시지를 돌려줍니다.

## 구조

```
projects/                   Vite root. 폴더 하나가 페이지 하나
  index.html, hub.css       /  허브 (projects/*/index.html을 찾아 목록을 자동으로 만듦)
  vite-env.d.ts
  emotion-face/             /emotion-face/
    index.html, style.css   페이지 마크업과 스타일
    main.ts                 화면, 입력, Jev 호출 흐름
    face.ts                 얼굴 모델 로딩, blendshape·머리·시선 구동
    emotions.ts             감정 8종의 색, 한국어 이름, 표정 프리셋
    bars.ts, meters.ts      확률 막대, blendshape 미터
    server.ts               Jev 질문 정의와 라우트 함수 (서버에서 실행)
api/
  emotion-face/emotion.ts   POST /api/emotion-face/emotion (Vercel Function)
server/
  api.ts                    serve(): 라우트를 Vercel Function으로 감싸는 공용 핸들러
  dev-api.ts                dev 서버가 api/ 파일을 그대로 실행하게 하는 Vite 플러그인
  projects.ts               프로젝트 탐색, 허브 목록, /<name> → /<name>/ 리다이렉트
public/                     공용 정적 파일 (models/facecap.glb, basis/ 텍스처 트랜스코더)
```

## 반응하는 얼굴: 동작 방식

1. **입력**: 첫 키 입력 후 90ms 동안의 입력을 묶어 보냅니다. 요청은 한 번에 하나만 보내고, 응답이 오면 그사이 바뀐 최신 문장을 바로 다시 보냅니다. 그래서 빠르게 타이핑해도 표정이 문장을 따라갑니다.
2. **서버**: `readEmotion()`이 문장을 `state`에 담고, 질문 두 개(`emotion`, `intensity`)를 `systemOne` 호출 한 번으로 묻습니다.
3. **얼굴**: 감정 확률을 제곱해 정규화한 비율로 표정 프리셋을 섞고, `(score / 4) ^ 0.6`만큼의 세기로 적용합니다. 가중치는 매 프레임 부드럽게 따라가고, 깜빡임·미세한 시선 이동·머리 흔들림이 더해집니다.
4. **패널**: 요약(감정, 강도, 점수→단계), 감정·강도 확률 막대, 요청 정보(확신도, 응답 시간, 입력 토큰, 요청 수, 실패 수), blendshape 52개, 원본 응답/요청 JSON을 보여줍니다. 라벨 옆에는 대응하는 Jev 응답 필드 이름(`emotion`, `intensity`, `confidence` 등)을 작게 적었습니다.

- 감정 8종: 중립(neutral), 기쁨(happy), 슬픔(sad), 분노(angry), 놀람(surprised), 두려움(fear), 혐오(disgust), 경멸(contempt)
- 예시 문장: 감정마다 하나씩 한국어 8개(각각 Jev로 확인), 영어 2개
- 강도 5단계: 0 거의 없음 · 1 약함 · 2 분명함 · 3 강함 · 4 압도적

### API

`POST /api/emotion-face/emotion`

```jsonc
// 요청
{ "text": "We got the apartment!!" }

// 응답
{
  "response": { "model": "jev-1.13.0", "answers": { "emotion": { … }, "intensity": { … } }, "usage": { … } },
  "request": { "model": "jev-latest", "state": { … }, "questions": { … } },
  "latency_ms": 212
}
```

| 상태 코드 | 의미 |
| --- | --- |
| 400 | 본문이 JSON이 아니거나 `text`가 비어 있음 |
| 405 | POST가 아님 |
| 413 | `text`가 2,000자를 넘음 |
| 500 | `TYPESAFE_AI_API`가 설정되지 않음 |
| 502 | Jev 호출 실패 (SDK의 에러 메시지를 그대로 전달) |

## 새 실습 추가하기

1. `projects/<name>/index.html`을 만듭니다. `/<name>/`로 열리고, `<title>`과 `<meta name="description">`의 내용으로 허브 목록에 자동으로 올라갑니다.
2. 서버에서 Jev를 불러야 하면 라우트 함수 `(body, jev) => Promise<결과>`를 만들고, `api/<name>/<route>.ts`에서 `export default serve(fn)`으로 내보냅니다. 그러면 `POST /api/<name>/<route>`로 열립니다.
3. 여러 실습이 같이 쓰는 파일은 `public/`에 둡니다.

## 알려진 한계

- 얼굴 모델의 치아는 움직이지 않는 별도 메시라서, 입을 크게 벌리는 표정(놀람, 공포)에서는 어색하게 보일 수 있습니다.
- `npm run preview`로는 API를 쓸 수 없습니다. 로컬에서는 `npm run dev`를 쓰세요.

## 크레딧

- 모델: [TypeSafe AI](https://typesafe.ai) Jev
- 얼굴 모델: [Face Cap](https://www.bannaflak.com/face-cap) by Bannaflak (three.js 예제의 `facecap.glb`)
- 기반 코드: three.js [“morph targets – face”](https://threejs.org/examples/#webgl_morphtargets_face) 예제
