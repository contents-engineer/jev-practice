// Situations for the sample chips. Expected labels are hypotheses for a live smoke check,
// not measured feelings.
export const SAMPLES = [
  { text: '내일 첫 면접인데 벌써 손이 떨려요', emotion: 'fear' },
  { text: '드디어 최종 합격 전화를 받았어요!', emotion: 'happy' },
  { text: '3년 만난 사람과 헤어지고 처음 밖에 나가요', emotion: 'sad' },
  { text: '팀장이 제 아이디어를 자기 것처럼 발표했어요', emotion: 'angry' },
  { text: '문을 열자마자 친구들이 깜짝 파티를 해 줬어요', emotion: 'surprised' },
  { text: '평소처럼 출근하는 월요일이에요', emotion: 'neutral' },
] as const;
