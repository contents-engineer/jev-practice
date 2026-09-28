// Shared by the UI and the live regression evaluation. Expected labels are hypotheses,
// not measured human reactions; keep independent evaluation cases too.
export const SAMPLES = [
  { text: '내일 회의 3시로 옮겼어. 장소는 2층 회의실이야.', emotion: 'neutral' },
  { text: '생일 축하해! 네 덕분에 올해 정말 행복했어', emotion: 'happy' },
  { text: '미안해… 수의사 선생님이 이제 더 해줄 수 있는 게 없대.', emotion: 'sad' },
  { text: '너 내 카톡 몰래 봤어? 진짜 어이가 없다.', emotion: 'angry' },
  { text: '잠깐, 너 한국 왔다고?? 언제부터?!', emotion: 'surprised' },
  { text: '문 열지 마. 누가 밤새 나를 따라오고 있어.', emotion: 'fear' },
  { text: '우리가 일주일 내내 먹던 쌀 포대에서 죽은 쥐가 나왔어 🤢', emotion: 'disgust' },
  { text: '시험 커닝해서 A 받았어ㅋㅋ 공부하는 애들은 바보지', emotion: 'contempt' },
  { text: 'We got the apartment!! Moving in next month 🎉', emotion: 'happy' },
  { text: "Don't open the door. Someone has been following me all night.", emotion: 'fear' },
  { text: '그 얘기는 사실 내가', emotion: 'unclear' },
] as const;
