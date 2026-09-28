# Jev 실험실 (Jev Lab)

TypeSafe AI의 System One 모델 **Jev**를 익히기 위한 실습 모음입니다.

첫 실습 **반응하는 얼굴**(`/emotion-face/`)은 메시지로부터 받는 사람의 감정과 전반적인 반응 강도를 추정하고, 그 결과를 3D 얼굴의 ARKit blendshape 52개에 적용합니다. 감정 8종과 별개로 `unclear`(판단 어려움)를 두며, 실제 수신자의 감정을 측정하는 도구는 아닙니다.

- 배포: https://jev-practice-delta.vercel.app
  - `/`: 실습 목록 (Jev 실험실)
  - `/emotion-face/`: 반응하는 얼굴
- 화면은 한국어 사용자를 기준으로 만들었습니다. Jev에 보내는 질문 기준(criteria)은 정확도가 가장 높은 영어로 둡니다.

## Jev 한눈에 보기

Jev는 글을 생성하지 않습니다. 상황(`state`)과 타입이 정해진 질문을 보내면, 질문마다 타입이 정해진 답과 확률을 한 번의 병렬 처리로 돌려줍니다. 흐름은 코드가 쥐고, 모델은 의미를 이해해야 하는 판단만 맡습니다.

| 질문 타입 | 돌려주는 값 | 이 프로젝트에서 |
| --- | --- | --- |
| `choice` | 고른 선택지, 선택지별 확률, confidence | `emotion`: 감정 8종 또는 `unclear` |
| `score` | 단계별 확률과 그 기대값(`score`), confidence | `intensity`: 전반적인 감정 반응 강도 0~4 |
| `noul` | 예일 확률 | 사용하지 않음 |

- `confidence`는 확률이 한 답에 얼마나 몰렸는지를 나타낼 뿐, 답이 맞다는 보증은 아닙니다.
- 이 프로젝트는 공식 JS SDK(`@typesafe-ai/sdk`)로 `POST https://api.typesafe.ai/v1/systemone`을 호출합니다. 기본 모델은 `jev-latest`입니다. 재현성을 높이려면 서버 환경변수 `TYPESAFE_MODEL`에 지원되는 고정 버전을 지정하세요. 실제 사용된 버전은 응답과 평가 보고서에 남습니다.
- 비용·지연 시간은 문장, 질문, 모델, 네트워크에 따라 달라집니다. 화면과 평가 보고서의 실제 토큰·지연 시간을 사용하고, 금액은 [현재 모델 요금](https://docs.typesafe.ai/models)으로 계산하세요.
- 공식 문서 기준으로 영어가 주 학습 언어이며 한국어를 포함한 다른 언어는 정확도가 더 낮을 수 있습니다. 아래 평가는 작은 개발자 작성 회귀 세트이며, 일반적인 감정 예측 정확도를 뜻하지 않습니다.
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
| `npm test` | API 호출 없는 입력 루프·요청 한도·입력 검증 회귀 테스트 |
| `npm run eval:emotion` | 실행 중인 로컬 API를 통해 실제 Jev로 예시와 별도 평가 문장 검증 (과금 발생) |

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
    reading-loop.ts         입력 revision, 90ms 묶음, 최신 요청 대기열
    samples.ts              화면과 평가 도구가 공유하는 예시·기대 감정
    face.ts                 얼굴 모델 로딩, blendshape·머리·시선 구동
    emotions.ts             감정 8종과 unclear의 색·이름·표정 프리셋
    bars.ts, meters.ts      확률 막대, blendshape 미터
    server.ts               Jev 질문 정의와 라우트 함수 (서버에서 실행)
api/
  emotion-face/emotion.ts   POST /api/emotion-face/emotion (Vercel Function)
server/
  api.ts                    serve(): 라우트를 Vercel Function으로 감싸는 공용 핸들러
  budget.ts                 서버 인스턴스별 요청·동시 실행 한도
  dev-api.ts                dev 서버가 api/ 파일을 그대로 실행하게 하는 Vite 플러그인
  projects.ts               프로젝트 탐색, 허브 목록, /<name> → /<name>/ 리다이렉트
public/                     공용 정적 파일 (models/facecap.glb, basis/ 텍스처 트랜스코더)
tests/emotion.test.mjs       과금 없는 회귀 테스트
evals/emotion-cases.json     화면 예시와 별도로 작성한 평가 문장·허용 감정·강도 범위
scripts/evaluate-emotion.mjs 실제 HTTP/Jev 평가, 원본 요청·응답 포함 보고서 생성
```

## 반응하는 얼굴: 동작 방식

1. **입력**: 첫 변경 후 90ms 동안 입력을 모읍니다. 요청은 한 번에 하나만 보내고, 요청 중 변경된 값은 최신 하나만 이어서 보냅니다. 공백 정리 후 문장이 바뀔 때마다 revision을 올려 이전 응답·오류를 버립니다. 문장을 비웠다가 같은 문장을 입력해도 이전 응답은 적용하지 않습니다. 연속 타이핑 중에는 현재 문장의 응답이 올 때까지 표정 적용이 기다릴 수 있습니다.
2. **서버**: `readEmotion()`이 문장을 `state`에 담고 독립적인 질문 두 개를 한 번에 묻습니다. `emotion`은 수신자의 주된 감정, `intensity`는 감정 종류와 무관한 전반적인 반응 강도입니다. 질문끼리는 서로의 답을 볼 수 없습니다. 관계나 이전 대화는 제공하지 않으며, 임의로 만들어 판단하지 않도록 지시합니다.
3. **얼굴**: 확률을 제곱·정규화한 비율로 프리셋을 섞고 `(score / 4) ^ 0.6` 세기로 적용합니다. 이는 시각적 연출이며 **Choice 확률은 동시 감정의 혼합 비율이 아닙니다**. `unclear`이면 얼굴을 기본 자세로 두고 강도 요약·막대를 숨깁니다. 원본 강도 응답은 보존합니다. 새 입력이나 오류 대기 중에도 기본 자세를 사용합니다.
4. **패널**: 마지막으로 분석한 문장과 결과를 함께 보존하되, 새 입력을 분석 중이거나 실패하면 이전 결과임을 표시합니다. 입력을 비우면 원본 JSON도 지웁니다. 강도 요약 단계는 기대값 반올림이고, 확률 막대의 강조는 확률이 가장 높은 단계입니다. 둘은 다를 수 있습니다.
5. **측정**: `서버 Jev 호출`은 SDK 호출(재시도 포함) 구간이며, `입력→결과 수신`은 해당 문장의 마지막 변경부터 입력 대기·요청 대기·HTTP 왕복·JSON 수신까지입니다. 후자는 GPU 렌더링·표정 보간 완료 시간은 포함하지 않습니다. 토큰과 두 confidence는 원본 값이며, confidence에 임의의 차단 임계값을 두지 않습니다.

- 감정 8종: 중립(neutral), 기쁨(happy), 슬픔(sad), 분노(angry), 놀람(surprised), 두려움(fear), 혐오(disgust), 경멸(contempt)
- 별도 결과: 판단 어려움(unclear). 중립은 이해 가능한 무감정 문장이고, unclear는 불완전한 문장·부족한 맥락·상충하는 해석 등입니다.
- 예시 문장: 감정별 한국어 8개, 영어 2개, 한국어 미완성 문장 1개
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
| 429 | 해당 서버 인스턴스의 동시 실행·분당·일일 요청 한도 초과 |
| 500 | `TYPESAFE_AI_API`가 설정되지 않음 |
| 502 | Jev 호출 실패 (SDK의 에러 메시지를 그대로 전달) |

### 요청 한도와 운영 범위

한 서버 인스턴스에서 동시 4개, 분당 120개, UTC 날짜별 2,000개 요청을 허용합니다. 입력 검증을 통과해 허용된 요청은 실패해도 집계하며, SDK 재시도(최대 1회)는 별도 API 사용량이므로 과금 호출 수와 일치하지 않습니다. 브라우저 요청은 15초 뒤 중단되며, 서버 SDK는 시도당 5초 제한을 사용합니다.

이는 메모리 기반의 기본 보호장치입니다. Vercel의 여러 인스턴스·콜드 스타트·재배포 전체를 합친 한도나 금액 상한을 보장하지 않습니다. 공개 서비스의 강제 예산 제한에는 공유 저장소 기반 제한 또는 제공자 측 예산 설정이 추가로 필요합니다. 현재 저장소에는 그 인프라가 연결되어 있지 않습니다.

### 실제 Jev 평가

1. `npm run dev`로 API를 실행합니다.
2. 다른 터미널에서 `npm run eval:emotion`을 실행합니다. 기본 주소는 `http://localhost:5173`이며 `EVAL_BASE_URL`로 변경할 수 있습니다.
3. `evals/reports/latest.json`에서 결과를 확인합니다. 실행마다 덮어쓰며 Git에서는 제외합니다. 비교 기록이 필요하면 별도 보관하세요.

평가는 화면 예시 11개와 독립 작성 문장 14개를 순차 호출합니다. 별도 세트에는 한국어·영어, 맥락 부족, 미완성 문장, 반어법, 복합 감정, 긍정→부정 문장이 있습니다. 미리 지정한 허용 감정 집합과 강도 범위를 검사하고, `unclear`이면 강도 검사를 건너뜁니다. 예시는 감정만 검사합니다. 실패 시 종료 코드는 1이며 서비스 실패를 모델 판단 불일치와 구분합니다.

보고서에는 실행 시각, 실제 모델 버전, 평가 데이터 해시, 문장별 기대값과 판정, 전체 state/questions/응답, 토큰 합계, HTTP 지연 시간 중앙값·p95가 포함됩니다. 개인정보를 넣은 평가 데이터를 공유할 때는 원본 문장이 포함된다는 점에 유의하세요. 평가 문장의 기대값을 관측 결과에 맞춰 바꾸지 말고, 질문을 조정할 때는 별도 새 문장으로도 확인하세요.

2026-09-28 검증: `jev-1.13.0`으로 예시 11/11, 별도 세트 14/14 통과, 서비스 실패 0건. 입력 토큰 총 29,392개, 로컬 HTTP 왕복 중앙값 210ms, p95 333ms였습니다. 단일 실행의 작은 회귀 세트 결과이며 일반 정확도·지연 시간 보장이 아닙니다. 타입 검사·빌드·회귀 테스트 6개도 통과했습니다. 연결된 브라우저가 없어 이번 변경의 시각적 검증은 수행하지 못했습니다.

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
