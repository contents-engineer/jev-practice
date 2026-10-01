// Case files shared by the page (browser) and the Jev route (server). Everything the suspect
// says is written here: Jev judges the detective's words, code selects the reply.

/** What the detective is doing with an utterance; the keys of the `move` Choice question. */
export type Move =
  | 'rapport'
  | 'open_question'
  | 'probe'
  | 'present_evidence'
  | 'bluff'
  | 'accuse'
  | 'demand'
  | 'threaten'
  | 'minimize'
  | 'off_topic'
  | 'unclear';

export const MOVES: readonly Move[] = [
  'rapport', 'open_question', 'probe', 'present_evidence', 'bluff', 'accuse', 'demand', 'threaten', 'minimize', 'off_topic', 'unclear',
];

/** Korean label and share emoji per move. */
export const MOVE_META: Record<Move, { ko: string; emoji: string; hint: string }> = {
  rapport: { ko: '라포', emoji: '🤝', hint: '공감·안심·배려' },
  open_question: { ko: '열린 질문', emoji: '❓', hint: '진술을 끌어내는 질문' },
  probe: { ko: '세부 추궁', emoji: '🔍', hint: '시간·장소·사람을 좁히는 질문' },
  present_evidence: { ko: '증거 제시', emoji: '📄', hint: '사건 파일의 증거를 들이밈' },
  bluff: { ko: '허세', emoji: '🎭', hint: '없는 증거·목격자를 지어냄' },
  accuse: { ko: '추궁', emoji: '👉', hint: '증거 없이 범행·거짓말 단정' },
  demand: { ko: '자백 요구', emoji: '✊', hint: '그만 둘러대고 사실대로 말하라는 요구' },
  threaten: { ko: '위협', emoji: '💢', hint: '처벌·불이익으로 압박' },
  minimize: { ko: '최소화', emoji: '🕊️', hint: '이해할 만한 동기·가벼운 버전 제시' },
  off_topic: { ko: '무관', emoji: '💤', hint: '사건과 상관없는 말' },
  unclear: { ko: '불명확', emoji: '❔', hint: '끊긴 문장·해석 불가' },
};

/** The suspect's composure, derived from the meters by the engine. */
export type Tier = 'calm' | 'open' | 'nervous' | 'defensive' | 'shaken' | 'breaking' | 'broken';

export const TIER_META: Record<Tier, { ko: string }> = {
  calm: { ko: '침착' },
  open: { ko: '마음이 열림' },
  nervous: { ko: '불안' },
  defensive: { ko: '방어적' },
  shaken: { ko: '동요' },
  breaking: { ko: '무너지기 직전' },
  broken: { ko: '무너짐' },
};

/** A thread of questioning with the suspect's cover story for it. */
export interface Topic {
  id: string;
  name_ko: string;
  name_en: string;
  /** For Jev: what questions on this topic ask about. */
  about: string;
  /** For Jev: Korean utterances that ask about this topic. */
  examples: string[];
  /** The suspect's first account (a lie), given when first asked. */
  statement: string;
  /** The same account in English, for the state Jev sees. */
  statement_en: string;
  /** Asked again: by composure. Missing tiers fall back to shaken, then calm. */
  pressed: Partial<Record<Tier, string[]>>;
}

export interface Evidence {
  id: string;
  name_ko: string;
  name_en: string;
  /** For Jev: what the item shows. */
  shows: string;
  /** Shown on the evidence card. */
  detail_ko: string;
  /** For Jev: Korean utterances that present this item. */
  examples: string[];
  /** The related topic; contradicts determines which accounts it actually refutes. */
  breaks: string | null;
  /** Topic-local statement ids actually contradicted by this item. Empty means no contradiction. */
  contradicts: string[];
  /** Presented after the suspect committed to the statement: caught. */
  crack: string;
  /** Presented before any statement on the topic: the story bends around it. */
  adapt: string;
  /** The bent story in English, for the state Jev sees after adapting. */
  adapted_statement_en?: string;
  /** Current account after being caught; never reconstruct it from the original lie. */
  cracked_statement_en?: string;
  adapted_pressed?: Partial<Record<Tier, string[]>>;
  cracked_pressed?: Partial<Record<Tier, string[]>>;
  /** Presented again. */
  repeat: string;
  /** Irrelevant item: brushed off. */
  deflect?: string;
}

export interface CaseFile {
  id: string;
  title: string;
  difficulty: '쉬움' | '보통' | '어려움';
  tagline: string;
  brief_ko: string[];
  summary_en: string;
  suspect: {
    name_ko: string;
    name_en: string;
    age: number;
    job_ko: string;
    description_en: string;
    /** Lamp colour on the stage. */
    tint: string;
    /** First line when the interview opens. */
    opening: string;
  };
  /** Multipliers on meter changes: the suspect's temperament. */
  personality: { pressureGain: number; guardGain: number; trustGain: number };
  start: { pressure: number; trust: number; guard: number };
  /** Distinct contradicted topics needed before the suspect can break. */
  cracksNeeded: number;
  maxTurns: number;
  topics: Topic[];
  evidence: Evidence[];
  /** Tutorial hints shown in the case file. */
  tips?: string[];
  endings: {
    /** Valid confession, paragraph by paragraph. */
    confession: string[];
    /** Confession obtained under threat or a false promise. */
    tainted: string[];
    lawyer: string;
    timeout: string;
  };
}

// ── Generic replies: move × composure. Missing tiers fall back to calm; `breaking`
// (story broken, pressure high, no closing move yet) falls back to shaken first. ──

export const GENERIC_LINES: Record<Move, Partial<Record<Tier, string[]>>> = {
  rapport: {
    calm: ['…고맙습니다. 근데 저 정말 아무 잘못 없어요.', '네, 물은 괜찮아요. 그냥 빨리 끝났으면 좋겠어요.'],
    open: ['…형사님은 좀 다르시네요. 아까 그분은 계속 소리만 질렀거든요.', '솔직히 무서워요. 이런 데 처음이라.'],
    nervous: ['…네. 조금 진정이 되네요. 고맙습니다.', '저도 이러고 싶지 않아요. 그냥… 집에 가고 싶어요.'],
    shaken: ['…(한참 말이 없다) 형사님, 저 어떻게 되는 거예요?', '…죄송해요. 잠깐만요. 숨 좀 쉴게요.'],
    defensive: ['갑자기 왜 친절하게 구세요. 뭐 하려고요.', '됐어요. 그런 거 안 통해요.'],
  },
  open_question: {
    calm: ['뭘 말씀드려야 하죠? 아는 건 다 말했는데요.', '처음부터요? 신고할 때 다 말했잖아요.'],
    nervous: ['…어디서부터 말해야 할지 모르겠어요.'],
    shaken: ['…말해도 안 믿으실 거잖아요.'],
    breaking: ['…(한참 말이 없다) 뭘 더 물어보시려고요. …다 아시잖아요.', '…처음부터요? …이제 와서 그게 무슨 소용이에요.'],
    defensive: ['진술서 있잖아요. 그거 읽으세요.'],
  },
  probe: {
    calm: ['그건… 잘 기억이 안 나요. 정신이 없었어요.', '정확히는 모르겠어요. 대충 그 정도였어요.'],
    nervous: ['그렇게 세세한 건… 기억 안 나요. 정말이에요.'],
    shaken: ['모르겠어요… 기억이 안 나요. 안 난다고요.'],
    breaking: ['…(손이 떨린다) 그런 건… 이제 중요하지 않잖아요.', '…모르겠어요. 정말 모르겠어요. …형사님, 저 어떻게 되는 거예요?'],
    defensive: ['그게 왜 중요하죠? 범인이나 잡으세요.'],
  },
  present_evidence: {
    calm: ['무슨 증거요? 보여 주세요.', '증거가 있으면 꺼내 보시죠.'],
    nervous: ['…뭐요? 뭐가 있는데요?'],
    shaken: ['…뭘 가지고 계신 거예요? 말해 주세요.'],
    breaking: ['…더 있어요? …됐어요. 그만 보여 주세요.'],
    defensive: ['있으면 보여 주고, 없으면 그만하세요.'],
  },
  // The engine reads shaken lines when the bluff lands and calm/defensive lines when it is called.
  bluff: {
    calm: ['그런 증거가 있을 리가 없죠. 없는 걸로 몰지 마세요.', '누가 봤다고요? 누구요. 이름 말해 보세요.', '거짓말은 형사님이 하시네요.'],
    defensive: ['지어내지 마세요. 그런 거 없다는 거 저도 알아요.', '이거 다 녹음되죠? 없는 증거 얘기하신 거.'],
    shaken: ['…뭐라고요? 그게… 진짜예요?', '…(얼굴이 하얘진다) 누가… 누가 그래요?'],
  },
  accuse: {
    calm: ['제가요? 제가 왜요. 증거 있어요?', '아니에요. 저 아니라고요.'],
    open: ['…형사님까지 저를 의심하세요?'],
    nervous: ['아니라니까요! 몇 번을 말해요!', '저 아니에요. 진짜 아니에요.'],
    shaken: ['…아니에요. …아니라고요. (목소리가 갈라진다)'],
    defensive: ['그렇게 정해 놓고 물어보시면 뭐 하러 물어봐요.', '증거 없이 사람 몰지 마세요.'],
  },
  demand: {
    calm: ['말할 게 없어요. 저는 아무것도 안 했어요.', '사실대로 말했잖아요. 뭘 더 말하라는 거예요.'],
    open: ['…형사님까지 그러시면… 저 정말 아니에요.'],
    nervous: ['다 말했다고요! 뭘 더요!', '…사실이에요. 사실이라고요.'],
    shaken: ['…(입술을 깨문다) 말할 게… 없어요.'],
    defensive: ['진술 거부하겠습니다.', '변호사 없이는 더 말 안 해요.'],
  },
  threaten: {
    calm: ['협박하시는 거예요? 그럼 저도 변호사 부를게요.', '그렇게 나오시면 더 할 말 없어요.'],
    open: ['…방금 그 말, 진심이세요?'],
    nervous: ['왜, 왜 그러세요… 저 진짜 아무것도 안 했어요.'],
    shaken: ['제발… 그만하세요. 무서워요.'],
    defensive: ['이거 녹음되고 있죠? 지금 하신 말 기억하세요.', '변호사 오기 전까지 아무 말도 안 할 거예요.'],
  },
  minimize: {
    calm: ['제가 그랬다는 전제로 말씀하시네요. 저 안 했어요.', '누구라도 그랬을 거라고요? 저는 아니에요.'],
    open: ['…그렇게 말씀해 주시니까… 아니에요. 아니에요.', '홧김이라… 그런 거였으면 차라리 나았겠죠.'],
    nervous: ['…그게 무슨 말씀이세요.'],
    shaken: ['…(고개를 숙인다) 저도 이러고 싶지 않았어요.'],
    defensive: ['수작 부리지 마세요. 그런 식으로 자백 받아 내려는 거잖아요.'],
  },
  off_topic: {
    calm: ['…네? 무슨 말씀이신지.', '지금 그게 무슨 상관이죠?'],
    nervous: ['…네?', '(멍하니 형사를 본다)'],
    shaken: ['…'],
    breaking: ['…(대답이 없다. 형사를 보지 않는다)', '…네? …아, 네.'],
    defensive: ['장난하세요?'],
  },
  unclear: {
    calm: ['…뭐라고요? 다시 말씀해 주세요.', '말씀이 끊긴 것 같은데요.'],
    nervous: ['…네? 잘 못 들었어요.'],
    shaken: ['…'],
    breaking: ['…(고개를 든다) …뭐라고요?'],
    defensive: ['똑바로 말씀하세요.'],
  },
};

// ── Case 1 ───────────────────────────────────────────────────────────────

const convenience: CaseFile = {
  id: 'convenience',
  title: '새벽 2시의 편의점',
  difficulty: '쉬움',
  tagline: '복면 강도가 금고를 털었다는 야간 알바. 그런데 CCTV엔 아무도 없다.',
  brief_ko: [
    '9월 12일 새벽 2시경, 하늘동 24시 편의점 금고에서 현금 430만 원이 사라졌다. 야간 근무자 박준영(24)은 "복면을 쓴 남자가 흉기로 위협해 금고를 열게 했다"고 신고했다.',
    '점장은 주말이라 금고에 현금이 평소보다 많았다고 진술했다. 박준영은 8개월째 야간 근무 중이며, 신고 직후부터 "빨리 끝내 달라"며 초조해했다.',
  ],
  summary_en:
    'Around 2 a.m. on 12 September, 4.3 million won in cash disappeared from the safe of a 24-hour convenience store. The night clerk, Park Jun-young (24), reported that a masked man threatened him with a knife and forced him to open the safe. Investigators suspect the clerk staged the robbery himself.',
  suspect: {
    name_ko: '박준영',
    name_en: 'Park Jun-young',
    age: 24,
    job_ko: '편의점 야간 아르바이트',
    description_en: 'Night-shift clerk. Talkative, loudly protests his innocence, easily rattled by specifics.',
    tint: '#f2b134',
    opening: '저기요, 저 신고한 사람이에요. 피해자라고요. 왜 제가 여기 앉아 있어야 하죠?',
  },
  personality: { pressureGain: 1, guardGain: 1, trustGain: 1 },
  start: { pressure: 10, trust: 20, guard: 15 },
  cracksNeeded: 2,
  maxTurns: 12,
  tips: [
    '먼저 그날 밤 이야기를 시키세요. 진술이 나와야 증거로 깰 수 있습니다.',
    '증거는 이름을 불러 제시하세요. "CCTV에 1시 40분에…"처럼요.',
    '협박이나 "자백하면 봐준다"는 약속은 자백을 무효로 만듭니다.',
    '이야기가 무너지면 캐묻지 말고 자백을 요구하세요. 질문만으로는 자백이 나오지 않습니다.',
  ],
  topics: [
    {
      id: 'night',
      name_ko: '그날 밤 상황',
      name_en: 'What happened that night',
      about: 'What happened at the store around 2 a.m.: the alleged robber, how he entered and left, what he did, what the clerk did.',
      examples: ['그날 밤에 무슨 일이 있었는지 처음부터 말해 보세요.', '강도는 어떻게 생겼어요? 어디로 들어왔죠?', '몇 시에 들어왔어요?'],
      statement:
        '2시 조금 전이었어요. 검은 마스크에 모자 쓴 남자가 정문으로 들어와서… 칼 같은 걸 들이대면서 금고 열라고 했어요. 저는 무서워서 시키는 대로 했고, 돈 챙기더니 바로 나갔어요. 한 30초? 정말 순식간이었어요.',
      statement_en:
        'Just before 2 a.m. a man in a black mask and cap came in through the front door, threatened me with something like a knife, made me open the safe, took the cash and left within about thirty seconds.',
      pressed: {
        calm: ['아까 말씀드린 그대로예요. 마스크 쓴 남자, 칼, 금고. 더 기억나는 게 없어요.'],
        nervous: ['똑같아요… 정문으로 들어왔고, 칼 들이대고… 제가 뭘 더 말해야 하죠?'],
        shaken: ['그… 정문이요. 아니, 정문 맞아요. 제가 계산대에 있었으니까 봤죠. 봤어요.'],
        defensive: ['같은 걸 몇 번이나 물어보세요? 피해자 진술은 아까 다 했잖아요.'],
      },
    },
    {
      id: 'safe',
      name_ko: '금고와 비밀번호',
      name_en: 'The safe and its code',
      about: 'How the safe was opened, who knows the code, whether the clerk has a code, the safe’s records.',
      examples: ['금고 비밀번호는 누가 알고 있죠?', '금고는 어떻게 열렸어요?', '금고 코드는 본인도 갖고 있나요?'],
      statement:
        '금고 비밀번호는 점장님만 아세요. 저는 몰라요. 강도가 어떻게 열었냐고요? 그건 저도… 아마 점장님이 어디 적어 두셨거나, 그 사람이 뭘 알고 온 거겠죠.',
      statement_en: 'Only the store manager knows the safe code; I do not know it. I have no idea how the robber opened it.',
      pressed: {
        calm: ['비밀번호는 정말 몰라요. 점장님한테 물어보세요.'],
        nervous: ['모른다니까요. 점장님이 저한테 알려 줄 리가 없잖아요… 알바한테.'],
        shaken: ['제가… 몰라요. 모른다고요.'],
        defensive: ['금고 얘기는 점장님이랑 하세요. 저는 알바예요.'],
      },
    },
    {
      id: 'money',
      name_ko: '돈 문제',
      name_en: 'Personal finances',
      about: 'The clerk’s financial situation: debts, loans, money troubles, a motive.',
      examples: ['요즘 돈 문제는 없어요?', '대출이나 빚이 있나요?', '월급으로 생활은 되고요?'],
      statement: '돈 문제요? 없어요. 월급이 많진 않아도 혼자 사는 데는 충분해요. 저 그런 걸로 의심하시는 거예요?',
      statement_en: 'I have no money problems; my wages are enough for living alone.',
      pressed: {
        calm: ['빚 없다니까요. 통장 보여 드릴까요?'],
        nervous: ['돈 얘기가 왜 자꾸 나와요… 저 괜찮아요. 괜찮다고요.'],
        shaken: ['…조금 어려운 건 맞아요. 근데 그거랑 이거랑 무슨 상관이에요.'],
        defensive: ['제 사생활을 왜 물어보세요? 강도를 잡으셔야죠.'],
      },
    },
  ],
  evidence: [
    {
      id: 'cctv',
      name_ko: 'CCTV 기록',
      name_en: 'Store CCTV',
      shows:
        'At 1:40 a.m. someone in a staff vest turned the counter camera toward the wall. The entrance camera shows no one entering between 1:30 and 2:20, and the front-door sensor logged no opening in that window.',
      detail_ko:
        '1시 40분, 직원 조끼를 입은 사람이 계산대 카메라를 벽 쪽으로 돌렸다. 출입구 카메라와 정문 개폐 센서에는 1시 30분~2시 20분 사이 아무도 들어온 기록이 없다.',
      examples: ['CCTV 봤는데 1시 40분에 카메라를 돌린 사람이 있어요.', '정문 센서에는 그 시간에 문이 열린 기록이 없는데요?', '출입구 카메라에 강도가 안 찍혔어요.'],
      breaks: 'night',
      contradicts: ["initial", "adapt:door"],
      crack: '…그, 그건… 카메라가 원래 잘 안 됐어요. 자주 돌아가요. 문 센서도 고장이… 아니, 그러니까… 강도가 들어온 건 맞아요. 제가 봤다니까요.',
      adapt: '아, 그 카메라요. 그건 제가 청소하다 건드렸어요, 1시 40분쯤에. 그리고 강도는… 정문이 아니라 뒷문으로 들어왔어요. 제가 정신이 없어서 정문이라고 한 거예요.',
      adapted_statement_en: 'The robber came in through the back door, not the front; I bumped the counter camera while cleaning around 1:40.',
      repeat: 'CCTV 얘기는 아까 했잖아요. 카메라가 고장 났다고요.',
      cracked_statement_en: "The robber entered through the front door; the camera and door sensor must have malfunctioned.",
      adapted_pressed: { calm: ["청소하다 카메라를 건드렸고, 강도는 뒷문으로 들어왔어요."] },
      cracked_pressed: { calm: ["정문으로 들어오는 걸 봤어요. 카메라와 센서가 고장 났던 거예요."] },
    },
    {
      id: 'safe_log',
      name_ko: '금고 개폐 기록',
      name_en: 'Safe access log',
      shows:
        'The electronic safe logs each opening with the code used. At 1:52 a.m. it was opened with the personal code registered to Park Jun-young, entered correctly on the first try.',
      detail_ko: '전자 금고는 열 때마다 사용한 코드를 기록한다. 1시 52분, 박준영 명의로 등록된 개인 코드로 한 번에 열렸다.',
      examples: ['금고 기록에 1시 52분에 당신 코드로 열렸다고 나와요.', '개인 코드가 등록돼 있던데요. 비밀번호 모른다면서요?', '금고가 한 번에 열렸더라고요. 당신 코드로.'],
      breaks: 'safe',
      contradicts: ["initial"],
      crack: '…제 코드요? 그게… 점장님이 예전에 만들어 주셨는데 저는 쓴 적이… 아니… 그날은 강도가 시켜서… 아, 아까 모른다고 한 건… 헷갈렸어요.',
      adapt: '아… 네, 사실 개인 코드는 있어요. 점장님이 만들어 주셨어요. 강도가 열라고 하니까 제가 열었죠. 어쩔 수 없었어요.',
      adapted_statement_en: 'I do have a personal safe code; the robber forced me to open the safe with it.',
      repeat: '코드 얘기는 아까 다 했어요. 강도가 시켜서 열었다고요.',
      cracked_statement_en: "I have a personal safe code created by the manager and opened the safe because the robber forced me; my earlier denial was wrong.",
      adapted_pressed: { calm: ["개인 코드는 있어요. 강도가 시켜서 열었어요."] },
      cracked_pressed: { calm: ["코드를 모른다고 한 건 잘못 말한 거예요. 강도가 시켜서 열었어요."] },
    },
    {
      id: 'loan',
      name_ko: '대부업체 독촉 문자',
      name_en: 'Lender’s collection messages',
      shows:
        'Text messages from a private lender on Park’s phone: 6.2 million won overdue, a final notice on 11 September, and a threat to visit his workplace.',
      detail_ko: '박준영의 휴대전화에 온 대부업체 문자. 연체 620만 원, 9월 11일 최종 통보, "근무지로 찾아가겠다"는 내용.',
      examples: ['대부업체에서 620만 원 연체됐다고 문자 왔던데요.', '9월 11일에 최종 통보 받았죠? 직장으로 찾아온다고.', '빚이 있잖아요. 문자 다 봤어요.'],
      breaks: 'money',
      contradicts: ["initial"],
      crack: '…그거 보셨구나. …네. 찾아온다고 했어요. 가게로. 점장님이 알면 저 잘려요. 근데 그거랑 강도랑은… 상관없어요. 상관없다고요.',
      adapt: '…빚이 좀 있긴 해요. 근데 다들 그 정도는 있잖아요. 그래서 제가 강도랑 짰다는 거예요? 아니에요.',
      adapted_statement_en: 'I do have some debt, like everyone; it has nothing to do with the robbery.',
      repeat: '빚 얘기는 이미 했잖아요. 그만하세요.',
      cracked_statement_en: "I have overdue debt and the lender threatened to visit the store; I feared losing my job, but deny any link to the robbery.",
      adapted_pressed: { calm: ["빚은 있지만 강도 사건과는 상관없어요."] },
      cracked_pressed: { calm: ["독촉 문자는 받았어요. 점장님이 알면 잘릴까 봐 숨긴 거예요."] },
    },
    {
      id: 'door',
      name_ko: '뒷문 잠금장치',
      name_en: 'Back-door lock',
      shows:
        'The back door was found locked from inside with the deadbolt on and no forced-entry marks. Its alarm was armed all night and never triggered.',
      detail_ko: '뒷문은 안쪽에서 빗장이 걸린 채 잠겨 있었고 강제 개방 흔적이 없다. 뒷문 경보 장치는 밤새 켜져 있었고 한 번도 울리지 않았다.',
      examples: ['뒷문은 안에서 잠겨 있었어요. 경보도 안 울렸고요.', '뒷문으로 들어왔다면서요? 빗장이 걸려 있었는데.'],
      breaks: 'night',
      contradicts: ["adapt:cctv"],
      crack: '뒷문이… 잠겨 있었어요? 그럼… 그럼 어디로… 아니, 저는 그냥 본 대로 말한 거예요. 정말이에요.',
      adapt: '뒷문요? 그쪽은 제가 잘 안 가요. 강도는 정문으로 들어왔다니까요.',
      adapted_statement_en: 'The robber came through the front door; I rarely go near the back door.',
      repeat: '뒷문 얘기는 아까 했어요.',
      cracked_statement_en: "I cannot explain how the robber entered if the back door was locked, but still insist I saw a robber.",
      adapted_pressed: { calm: ["저는 뒷문에 잘 안 가요. 강도는 정문으로 들어왔어요."] },
      cracked_pressed: { calm: ["잠긴 뒷문으로 어떻게 들어왔는지는 설명 못 하겠어요. 그래도 강도는 봤어요."] },
    },
    {
      id: 'receipt',
      name_ko: '매출 마감 전표',
      name_en: 'Closing sales slip',
      shows: 'The register’s closing slip printed at 2:10 a.m. shows normal sales totals and no unusual transactions.',
      detail_ko: '2시 10분에 출력된 계산대 마감 전표. 매출 합계가 정상이고 이상 거래가 없다.',
      examples: ['마감 전표 보니까 2시 10분에 정상 마감했던데요.', '전표에는 이상한 게 없더라고요.'],
      breaks: null,
      contradicts: [],
      crack: '',
      adapt: '',
      repeat: '전표 얘기는 아까 했어요.',
      deflect: '네, 마감은 제가 늘 하던 대로 했어요. 강도가 나간 다음에 손이 떨려서 좀 늦게 했죠. 그게 문제가 되나요?',
    },
  ],
  endings: {
    confession: [
      '…네. 제가 했어요.',
      '11일에 문자 받고 잠을 못 잤어요. 가게로 찾아온다는데, 점장님이 알면 저는 끝이잖아요. 주말이라 금고에 돈이 많은 것도 알고 있었고요. 1시 40분에 카메라를 돌리고, 제 코드로 금고를 열었어요. 돈은 창고 쌀 포대 뒤에 있어요. 한 푼도 안 썼어요.',
      '강도 얘기는… 그냥 그렇게 하면 넘어갈 줄 알았어요. 죄송합니다. 점장님한테는 제가 직접 말씀드릴게요.',
    ],
    tainted: ['…네, 제가 했다고요! 됐죠? 그렇게 말하라면서요.', '…돈이요? 몰라요. 그냥 제가 했다고 쓰세요. 나가게 해 주세요.'],
    lawyer: '더 이상 말 안 할래요. 변호사 불러 주세요. 저 피해자라고요, 왜 저한테 이러세요.',
    timeout: '이제 가도 되죠? …강도 꼭 잡아 주세요.',
  },
};

// ── Case 2 ───────────────────────────────────────────────────────────────

const hitrun: CaseFile = {
  id: 'hitrun',
  title: '11번 국도 뺑소니',
  difficulty: '보통',
  tagline: '밤 11시 20분, 자전거를 치고 달아난 은색 SUV. 차주는 그 시간에 집에 있었다고 한다.',
  brief_ko: [
    '9월 3일 밤 11시 20분경, 11번 국도 갓길에서 자전거로 퇴근하던 40대 남성이 차량에 치여 중상을 입었다. 차량은 정차하지 않고 달아났다.',
    '피해자 뒤를 따르던 차량의 블랙박스에 은색 SUV가 찍혔다. 번호판 일부 "52더"로 조회된 차량 중 하나가 물류회사 과장 김도현(35)의 차다. 김도현은 그날 회식에 참석했고, 9시에 귀가했다고 주장한다.',
  ],
  summary_en:
    'Around 11:20 p.m. on 3 September a cyclist was struck on Route 11 by a silver SUV that drove off, leaving him critically injured. A partial plate from a dashcam matches the SUV of Kim Do-hyun (35), a logistics company manager who attended a company dinner that evening and claims he was home by 9 p.m. Investigators suspect he drove drunk, hit the cyclist, fled, and had the bumper replaced the next morning.',
  suspect: {
    name_ko: '김도현',
    name_en: 'Kim Do-hyun',
    age: 35,
    job_ko: '물류회사 과장',
    description_en: 'Composed and methodical. Answers briefly, pushes back on anything not backed by a document, gets defensive under accusation, but respects precise facts.',
    tint: '#7fb2d6',
    opening: '변호사 없이도 괜찮습니다. 저는 그날 9시에 집에 들어갔고, 차는 주차장에 있었어요. 질문하시죠.',
  },
  personality: { pressureGain: 1, guardGain: 1.2, trustGain: 0.9 },
  start: { pressure: 8, trust: 18, guard: 25 },
  cracksNeeded: 3,
  maxTurns: 12,
  topics: [
    {
      id: 'whereabouts',
      name_ko: '그날 밤 행적',
      name_en: 'Whereabouts that night',
      about: 'Where the suspect was between 9 p.m. and midnight: when he left the dinner, how he got home, whether he drove.',
      examples: ['그날 밤 몇 시에 집에 들어갔어요?', '회식 끝나고 어떻게 집에 갔어요?', '11시 20분에 어디 있었죠?'],
      statement:
        '회식은 9시 조금 전에 끝났고, 술을 안 마셨으니까 제가 운전해서 바로 집에 갔어요. 9시 반쯤 도착했을 겁니다. 그 뒤로는 집에 있었어요. 아내가 확인해 줄 거예요.',
      statement_en: 'The dinner ended just before 9 p.m.; I had not been drinking, so I drove straight home and arrived around 9:30. I stayed home afterwards; my wife can confirm.',
      pressed: {
        calm: ['9시 반에 집이었다고 말씀드렸잖아요. 기록이 필요하면 아파트 관리실에 물어보세요.'],
        nervous: ['…9시 반이요. 대충 그쯤이요. 시계를 보고 들어간 건 아니니까.'],
        shaken: ['집이었어요. 집… 아내한테 물어보세요. 아니, 아내는 자고 있었지만.'],
        defensive: ['같은 질문에 몇 번을 답해야 합니까? 기록해 두셨잖아요.'],
      },
    },
    {
      id: 'car',
      name_ko: '차량 상태와 수리',
      name_en: 'The car and its repairs',
      about: 'The condition of the suspect’s silver SUV: damage, repairs, washing, whether it was driven that week.',
      examples: ['차에 손상은 없었어요?', '최근에 차 수리한 적 있어요?', '그 주에 차를 몰긴 했어요?'],
      statement: '차는 멀쩡해요. 그 주에는 거의 안 탔고, 수리한 적도 없어요. 지금 주차장에 있으니까 가서 보세요.',
      statement_en: 'The car is fine. I barely drove it that week and have not had it repaired; it is in the parking lot if you want to look.',
      pressed: {
        calm: ['수리 안 했다니까요. 보시면 알 거예요.'],
        nervous: ['수리는… 정기 점검 정도요. 그건 수리라고 안 하잖아요.'],
        shaken: ['…차 얘기는 그만하죠. 차는 그냥 차예요.'],
        defensive: ['제 차를 압수라도 하시게요? 영장 가져오세요.'],
      },
    },
    {
      id: 'dinner',
      name_ko: '회식과 음주',
      name_en: 'The dinner and drinking',
      about: 'The company dinner that evening: who was there, how long it lasted, whether the suspect drank alcohol.',
      examples: ['회식에서 술은 얼마나 마셨어요?', '회식은 몇 시까지 했죠?', '그날 회식 자리에 누가 있었어요?'],
      statement: '회식은 팀 사람들끼리 7시부터 했어요. 저는 다음 날 새벽 출근이라 술은 안 마셨습니다. 콜라만 마셨어요. 팀원들이 다 봤어요.',
      statement_en: 'The team dinner started at 7 p.m. I had an early shift the next morning, so I drank no alcohol, only cola; the team saw that.',
      pressed: {
        calm: ['안 마셨다니까요. 팀원들한테 물어보세요.'],
        nervous: ['…한두 잔 정도는 마셨을 수도 있어요. 건배할 때요. 그건 안 마신 거나 마찬가지잖아요.'],
        shaken: ['…얼마나 마셨는지는 기억이 잘… 근데 운전할 정도는 됐어요.'],
        defensive: ['회식 얘기가 사고랑 무슨 상관입니까.'],
      },
    },
  ],
  evidence: [
    {
      id: 'dashcam',
      name_ko: '블랙박스 영상',
      name_en: 'Dashcam footage',
      shows: 'Dashcam from the car behind the victim, time-stamped 23:21: a silver SUV with a plate ending in 52더 swerves onto the shoulder, hits the cyclist and speeds off without braking.',
      detail_ko: '피해자 뒤차 블랙박스, 23시 21분. 번호판 뒷부분 "52더"인 은색 SUV가 갓길로 쏠리며 자전거를 치고 제동 없이 달아난다.',
      examples: ['블랙박스에 당신 차 번호판 52더가 찍혔어요.', '23시 21분 블랙박스 영상에 은색 SUV가 갓길로 쏠리는 게 나와요.', '영상 보셨죠? 브레이크도 안 밟았더군요.'],
      breaks: 'whereabouts',
      contradicts: ["initial", "adapt:cell", "crack:cell"],
      crack: '…52더요. 그 번호 차가 한두 대가 아닐 텐데요. …아니, 화질이 그렇게 좋아요? 그 시간에 제가… 저는 집에 있었다고요.',
      adapt: '아, 그 영상이요. 은색 SUV는 흔해요. 그리고 저는 그 시간에… 집 근처 편의점에 잠깐 나갔다 왔어요. 담배 사러요. 국도 쪽은 안 갔습니다.',
      adapted_statement_en: 'I was home by 9:30 but went out briefly near home around 11 to buy cigarettes; I never went near Route 11.',
      repeat: '블랙박스 얘기는 아까 했잖아요. 번호판 일부로 저라고 단정하지 마세요.',
      cracked_statement_en: "I still claim I was home and dispute that a partial plate identifies my SUV in the footage.",
      adapted_pressed: { calm: ["담배를 사러 집 근처에만 나갔어요. 국도에는 안 갔어요."] },
      cracked_pressed: { calm: ["번호판 일부만으로 제 차라고 단정할 수는 없잖아요. 저는 집에 있었어요."] },
    },
    {
      id: 'cell',
      name_ko: '기지국 위치 기록',
      name_en: 'Cell-tower location log',
      shows: 'The suspect’s phone connected to towers within 500 m of the crash site from 23:05 to 23:40, then moved toward his apartment, arriving at 23:58.',
      detail_ko: '김도현의 휴대전화가 23시 05분~23시 40분 사고 지점 반경 500m 기지국에 접속했고, 그 뒤 아파트 방향으로 이동해 23시 58분 도착.',
      examples: ['기지국 기록을 보면 11시 5분부터 40분까지 사고 현장 근처에 있었어요.', '휴대전화가 11시 58분에 아파트에 도착했다고 나와요. 9시 반이 아니라.', '전화기가 사고 지점 500미터 안에 있었는데요.'],
      breaks: 'whereabouts',
      contradicts: ["initial", "adapt:dashcam", "crack:dashcam"],
      crack: '…기지국이요. 그게 그렇게 정확해요? …전화기를… 회사 차에 두고 내렸을 수도 있죠. 아니, 저는… 그 기록이 저라는 증거는 아니잖아요.',
      adapt: '아, 그날 전화기를 회사 동료 차에 두고 내렸어요. 다음 날 찾았고요. 그래서 위치가 그렇게 나온 거예요.',
      adapted_statement_en: 'I left my phone in a colleague’s car that night and got it back the next day, which is why its location does not match mine.',
      repeat: '기지국 얘기는 이미 설명했어요.',
      cracked_statement_en: "I now suggest my phone may have been left in a company car; I deny that its location proves I was at the crash.",
      adapted_pressed: { calm: ["전화기를 동료 차에 두고 내렸고 다음 날 찾았어요."] },
      cracked_pressed: { calm: ["전화기를 회사 차에 두고 내렸을 수 있어요. 기록이 곧 제 위치라는 건 아니잖아요."] },
    },
    {
      id: 'repair',
      name_ko: '정비소 영수증',
      name_en: 'Repair shop receipt',
      shows: 'A receipt from a repair shop two towns away, dated 4 September 8:10 a.m.: front bumper and right headlight replaced, paid in cash, customer name left blank, vehicle plate ending 52더.',
      detail_ko: '두 동네 떨어진 정비소 영수증, 9월 4일 오전 8시 10분. 앞범퍼·오른쪽 헤드라이트 교체, 현금 결제, 고객명 공란, 차량번호 뒷자리 52더.',
      examples: ['9월 4일 아침에 정비소에서 앞범퍼랑 헤드라이트 갈았죠? 영수증 있어요.', '현금으로 범퍼 교체한 영수증이 있는데요. 이름은 비워 두고.', '정비소 영수증에 52더가 찍혀 있어요.'],
      breaks: 'car',
      contradicts: ["initial"],
      crack: '…그건… 주차하다 기둥에 긁은 거예요. 오래됐어요. 그날 아침에 간 건… 마침 시간이 나서요. 현금은… 카드 한도가 차서. 뭐가 문제죠.',
      adapt: '아, 범퍼요. 그 전 주에 주차장 기둥에 긁어서 바꿨어요. 사고랑은 상관없어요. 수리는 그것뿐입니다.',
      adapted_statement_en: 'I did replace the bumper on 4 September, but for a scrape against a parking pillar the week before; that is the only repair.',
      repeat: '범퍼 얘기는 아까 했어요. 기둥에 긁었다고요.',
      cracked_statement_en: "I admit replacing the bumper after an earlier parking-pillar scrape; I went that morning because I had time and paid cash because my card was at its limit.",
      adapted_pressed: { calm: ["전 주에 주차장 기둥에 긁어서 범퍼를 바꾼 거예요."] },
      cracked_pressed: { calm: ["수리한 건 맞아요. 기둥에 긁은 걸 그날 고쳤고, 카드 한도 때문에 현금으로 냈어요."] },
    },
    {
      id: 'carwash',
      name_ko: '세차장 결제 기록',
      name_en: 'Car-wash payment record',
      shows: 'A self-service car wash 3 km from the crash site charged the suspect’s card at 00:24 on 4 September; its camera shows a silver SUV with a dented front.',
      detail_ko: '사고 지점 3km의 셀프 세차장에서 9월 4일 0시 24분 김도현 카드 결제. 세차장 카메라에 앞부분이 찌그러진 은색 SUV.',
      examples: ['새벽 0시 24분에 세차장에서 카드 긁었죠? 사고 현장에서 3킬로예요.', '세차장 카메라에 앞이 찌그러진 SUV가 찍혔어요.', '그 밤에 굳이 세차를 했더라고요.'],
      breaks: 'car',
      contradicts: ["initial"],
      crack: '…세차요. 그, 그건… 벌레가 많이 붙어서… 새벽에요? …제가 원래 잠이 없어요. 찌그러진 건… 그림자 아니에요?',
      adapt: '아, 세차는 제가 자주 해요. 새벽에 한산하니까요. 앞부분은 그 전 주에 기둥에 긁은 거고요.',
      adapted_statement_en: 'I often wash the car at night when it is quiet; the front damage was from a parking pillar the week before.',
      repeat: '세차 얘기는 했잖아요.',
      cracked_statement_en: "I admit washing the car late at night to remove insects, but dispute that the image shows damage, suggesting a shadow.",
      adapted_pressed: { calm: ["새벽에 세차하곤 해요. 앞부분은 전 주에 기둥에 긁었어요."] },
      cracked_pressed: { calm: ["벌레 때문에 늦게 세차한 건 맞아요. 찌그러져 보이는 건 그림자일 수 있잖아요."] },
    },
    {
      id: 'coworker',
      name_ko: '동료 진술',
      name_en: 'Colleague’s statement',
      shows: 'A team member states that the suspect drank more than a bottle of soju, was the last to leave at 10:50 p.m., and insisted on driving despite offers to call a designated driver.',
      detail_ko: '팀원 진술. 김도현은 소주 한 병 넘게 마셨고, 10시 50분에 마지막으로 나갔으며, 대리 부르자는 말을 뿌리치고 직접 운전했다.',
      examples: ['팀원이 소주 한 병 넘게 마셨다고 진술했어요.', '동료 말로는 10시 50분에 마지막으로 나갔다던데요. 9시가 아니라.', '대리 부르자는 걸 뿌리쳤다면서요.'],
      breaks: 'dinner',
      contradicts: ["initial"],
      crack: '…누가 그래요? 이 대리요? …걔가 그날 저보다 더 마셨어요. 시간이야 그 친구가 착각한 거고… 한 병이라니, 그건… 반 병이었어요. 반 병.',
      adapt: '아, 그날 술을 조금 마시긴 했어요. 소주 몇 잔. 10시 50분에 나온 건 맞는데 대리를 불렀어요. 대리 기사가 집까지 데려다줬고요.',
      adapted_statement_en: 'I did have a few drinks and left at 10:50, but a designated driver took me home.',
      repeat: '동료 진술 얘기는 이미 했어요.',
      cracked_statement_en: "I now admit drinking half a bottle of soju but dispute the colleague’s estimate and departure time.",
      adapted_pressed: { calm: ["조금 마셨고 10시 50분에 나왔지만, 대리를 불렀어요."] },
      cracked_pressed: { calm: ["반 병 정도 마셨어요. 한 병은 아니고, 시간도 그 친구가 착각한 거예요."] },
    },
    {
      id: 'insurance',
      name_ko: '보험 무사고 할인 내역',
      name_en: 'No-claims insurance discount',
      shows: 'The suspect’s auto insurance has applied a no-accident discount for seven consecutive years; no claim has been filed this year.',
      detail_ko: '김도현의 자동차보험은 7년 연속 무사고 할인이 적용돼 있고, 올해 보험 청구는 없다.',
      examples: ['보험은 7년 무사고던데요.', '올해 보험 청구는 안 했더라고요.'],
      breaks: null,
      contradicts: [],
      crack: '',
      adapt: '',
      repeat: '보험 얘기는 했잖아요.',
      deflect: '네, 7년 무사고예요. 그러니까 제가 사고를 냈을 리가 없죠. 그 기록이 제 말을 뒷받침하는 거 아닌가요?',
    },
  ],
  endings: {
    confession: [
      '…네. 제가 쳤습니다.',
      '소주 한 병 반쯤 마셨어요. 대리를 부르면 다음 날 차 찾으러 가는 게 귀찮아서… 그냥 몰았습니다. 국도에서 전화를 보다가 갓길로 쏠렸고, 뭔가 부딪혔어요. 백미러로 자전거가 넘어지는 게 보였는데… 발이 안 떨어졌어요. 세차장에서 손이 떨려서 카드를 세 번 긁었어요. 아침에 범퍼를 갈면 없던 일이 될 줄 알았습니다.',
      '그분… 살아 계시죠? 죄송합니다. 제가 다 말하겠습니다.',
    ],
    tainted: ['…알았어요, 제가 했어요. 제가 쳤다고요. 됐습니까?', '더 말할 거 없어요. 변호사 오면 그때 얘기하죠.'],
    lawyer: '여기까지 하죠. 변호사 선임하겠습니다. 그 전까지 진술 거부하겠습니다.',
    timeout: '더 물어볼 거 없으시면 출근해야 해서요. 차는 주차장에 있으니 언제든 보세요.',
  },
};

// ── Case 3 ───────────────────────────────────────────────────────────────

const warehouse: CaseFile = {
  id: 'warehouse',
  title: '보험금',
  difficulty: '어려움',
  tagline: '창고 화재로 남편이 죽고, 3주 전 보험금은 두 배가 됐다. 아내는 울지 않는다.',
  brief_ko: [
    '9월 20일 새벽 2시 40분, 교외 주택 뒤편 창고에서 불이 나 남편 강민석(44)이 숨졌다. 아내 정서연(41)은 "연기 냄새에 깨어 나가 보니 창고가 불타고 있었다"고 진술했다.',
    '초기 감식은 전기 누전으로 추정했으나, 3주 전 남편 명의 사망보험금이 5억에서 12억으로 늘어난 사실이 확인됐다. 정서연은 보험설계사로 12년 일했다.',
  ],
  summary_en:
    'At 2:40 a.m. on 20 September a fire in the shed behind a suburban house killed Kang Min-seok (44). His wife, Jung Seo-yeon (41), a former insurance agent, says she woke to the smell of smoke and found the shed ablaze. The fire was first attributed to faulty wiring, but three weeks earlier the death benefit on the husband’s life policy was raised from 500 million to 1.2 billion won. Investigators suspect she sedated him and set the fire.',
  suspect: {
    name_ko: '정서연',
    name_en: 'Jung Seo-yeon',
    age: 41,
    job_ko: '전 보험설계사',
    description_en: 'Calm, articulate, precise about documents. Hard to pressure and quick to demand a lawyer when accused; responds to genuine empathy about her marriage.',
    tint: '#b58bd6',
    opening: '남편 장례를 치른 지 나흘 됐습니다. 형사님이 무슨 생각을 하시는지 알아요. 물어보세요. 저는 숨길 게 없습니다.',
  },
  personality: { pressureGain: 0.8, guardGain: 1.3, trustGain: 1.1 },
  start: { pressure: 5, trust: 15, guard: 30 },
  cracksNeeded: 3,
  maxTurns: 12,
  topics: [
    {
      id: 'night',
      name_ko: '그날 밤',
      name_en: 'That night',
      about: 'What the suspect did that night: when she went to bed, when she woke, what she saw and did during the fire, whether she went to the shed.',
      examples: ['그날 밤 일을 처음부터 말씀해 주세요.', '몇 시에 잠드셨어요?', '불이 난 걸 어떻게 아셨죠?'],
      statement:
        '11시쯤 같이 잠들었어요. 남편은 새벽에 창고에 나가는 버릇이 있어서, 없어진 줄도 몰랐고요. 2시 반쯤 연기 냄새에 깼는데 창고가 벌써… 소리를 지르면서 뛰어나갔는데 문이 안 열렸어요. 119는 이웃이 불렀어요. 남편은 그날 수면제를 먹지 않았어요.',
      statement_en:
        'We went to bed around 11 p.m. My husband often went out to the shed at night, so I did not notice him leave. Around 2:30 I woke to the smell of smoke; the shed was already burning and its door would not open. A neighbour called emergency services. My husband did not take sleeping pills that night.',
      pressed: {
        calm: ['말씀드린 그대로예요. 잠들었고, 연기 냄새에 깼어요.'],
        nervous: ['…11시요. 아니, 12시 가까이였을 수도 있어요. 그날은 잘 기억이 안 나요.'],
        shaken: ['제가 잠든 시간이 왜 중요하죠. …저는 자고 있었어요. 자고 있었다고요.'],
        defensive: ['진술서에 다 있습니다. 같은 걸 다시 묻는 이유가 뭐죠?'],
      },
    },
    {
      id: 'insurance',
      name_ko: '보험',
      name_en: 'The insurance',
      about: 'The husband’s life insurance: when it was taken out, why the benefit changed, who arranged it.',
      examples: ['보험은 언제 드셨어요?', '보험금이 왜 늘어났죠?', '보험 계약은 누가 처리했어요?'],
      statement: '보험은 6년 전에 남편이 원해서 들었어요. 제가 설계사니까 제 실적으로요. 금액은 그때 정한 그대로예요. 최근에 손댄 건 없어요.',
      statement_en: 'My husband wanted the policy six years ago and I wrote it as his agent. The benefit is what we set then; nothing has been changed recently.',
      pressed: {
        calm: ['6년 전 계약 그대로예요. 회사에 확인해 보세요.'],
        nervous: ['갱신은… 매년 자동으로 되는 거예요. 제가 뭘 한 게 아니라.'],
        shaken: ['…보험 얘기는 그만하죠. 남편이 죽었어요. 돈 얘기가 먼저인가요?'],
        defensive: ['보험금은 정당한 계약의 결과예요. 그걸로 저를 의심하시면 변호사를 부르겠습니다.'],
      },
    },
    {
      id: 'marriage',
      name_ko: '부부 관계',
      name_en: 'The marriage',
      about: 'The relationship between the suspect and her husband: conflicts, money, violence, plans to separate.',
      examples: ['남편과 사이는 어땠어요?', '부부 싸움은 없었나요?', '이혼 얘기가 오간 적 있어요?'],
      statement: '사이는 좋았어요. 요즘 부부치고는요. 남편이 사업 때문에 예민할 때가 있었지만, 그런 건 다들 있잖아요. 이혼이요? 그런 얘기 한 적 없어요.',
      statement_en: 'We were on good terms. He could be tense about his business, as anyone would be. We never talked about divorce.',
      pressed: {
        calm: ['평범한 부부였어요. 더 드릴 말씀이 없네요.'],
        nervous: ['…좋았어요. 좋았다고 생각해요. 사람 속은 모르는 거지만.'],
        shaken: ['(잠시 침묵) …형사님은 결혼하셨어요? 좋을 때도 있고, 아닐 때도 있어요.'],
        defensive: ['제 결혼 생활을 왜 심문하시죠? 그게 화재 원인이에요?'],
      },
    },
    {
      id: 'shed',
      name_ko: '창고',
      name_en: 'The shed',
      about: 'The shed where the fire started: who used it, who had keys, what was inside, what could have caused the fire.',
      examples: ['창고에는 뭐가 있었어요?', '창고 열쇠는 누가 갖고 있었죠?', '불이 왜 났다고 생각하세요?'],
      statement:
        '창고는 남편 공간이었어요. 공구랑 낚시 장비, 오래된 전기난로. 저는 열쇠도 없고 복제한 적도 없어요. 남편이 밤에 거기서 술 마시면서 난로 켜 놓고 잠든 적이 몇 번 있어서… 그날도 그랬을 거예요.',
      statement_en:
        'The shed was my husband’s space: tools, fishing gear, an old electric heater. I do not have a key and have never had one copied. He sometimes drank there at night and fell asleep with the heater on; that must be what happened.',
      pressed: {
        calm: ['열쇠는 남편만 갖고 있었어요. 저는 들어갈 일이 없었고요.'],
        nervous: ['난로요. 그 난로가 오래됐어요. 몇 번이나 바꾸라고 했는데.'],
        shaken: ['…창고에는 안 들어갔어요. 들어갈 수도 없었고요. 열쇠가 없으니까.'],
        defensive: ['감식 결과는 누전이라면서요. 그럼 된 거 아닌가요?'],
      },
    },
  ],
  evidence: [
    {
      id: 'policy',
      name_ko: '보험 증액 서류',
      name_en: 'Policy amendment',
      shows: 'A rider signed on 29 August, three weeks before the fire, raising the death benefit from 500 million to 1.2 billion won. The application is in the suspect’s handwriting and was filed through her former agency login.',
      detail_ko: '화재 3주 전인 8월 29일에 사망보험금을 5억에서 12억으로 올린 특약 서류. 신청서는 정서연의 필적이고, 전 소속 대리점 계정으로 접수됐다.',
      examples: ['8월 29일에 보험금을 12억으로 올리셨네요. 화재 3주 전에.', '증액 신청서 필적이 당신 거예요. 대리점 계정으로 접수됐고요.', '5억에서 12억으로 올린 특약, 설명해 보세요.'],
      breaks: 'insurance',
      contradicts: ["initial"],
      crack: '…그건… 남편이 부탁한 거예요. 사업이 어려워지면서 불안해했고… 제 계정으로 한 건 그게 빠르니까요. 필적은… 남편 대신 제가 쓴 거고요. 그게 뭐가 이상하죠. …3주 전인 건 우연이에요.',
      adapt: '네, 8월 말에 증액했어요. 남편이 원했어요. 제가 아까 최근에 손댄 게 없다고 한 건… 계약 자체를 말한 거예요. 특약은 다르잖아요.',
      adapted_statement_en: 'The benefit was raised in late August at my husband’s request; I handled the paperwork because it was faster through my old agency account.',
      repeat: '증액 얘기는 이미 설명드렸어요. 남편 뜻이었다고요.',
      cracked_statement_en: "I admit raising the benefit three weeks before the fire at my husband’s request, writing the application and using my agency login.",
      adapted_pressed: { calm: ["8월 말에 남편이 원해서 증액했고 제가 처리했어요."] },
      cracked_pressed: { calm: ["남편 부탁으로 제가 서류를 쓰고 접수한 거예요. 시기는 우연이에요."] },
    },
    {
      id: 'toxicology',
      name_ko: '수면제 처방과 혈액 검사',
      name_en: 'Sedative prescription and blood test',
      shows: 'The suspect filled a prescription for zolpidem on 15 September. The husband’s post-mortem blood shows zolpidem at roughly three times a sleeping dose; he had no prescription of his own.',
      detail_ko: '정서연이 9월 15일 졸피뎀(수면제)을 처방받았다. 남편의 부검 혈액에서 수면 용량의 약 3배에 해당하는 졸피뎀이 검출됐고, 남편에게는 처방 기록이 없다.',
      examples: ['남편 혈액에서 수면제가 나왔어요. 수면 용량의 세 배요.', '9월 15일에 졸피뎀 처방받으셨죠? 남편은 처방받은 적이 없는데.', '수면제는 누가 먹였을까요.'],
      breaks: 'night',
      contradicts: ["initial"],
      crack: '…(한참 말이 없다) 수면제는 제가 먹으려고 받은 거예요. 남편이… 잠을 못 자서 몇 알 가져갔을 수 있어요. 세 배요? 그 사람이 술이랑 같이 먹었나 보죠. 저는 자고 있었어요. 저는 몰라요.',
      adapt: '남편이 잠을 못 자서 제 약을 가져다 먹곤 했어요. 그날도 그랬을 거예요. 술이랑 같이 먹으면 위험하다고 그렇게 말했는데.',
      adapted_statement_en: 'My husband sometimes took my sleeping pills because he could not sleep; he must have taken them with alcohol that night. I was asleep until the smoke woke me at 2:30.',
      repeat: '수면제 얘기는 이미 했어요.',
      cracked_statement_en: "I now suggest my husband took my sleeping pills with alcohol; I deny administering them and maintain that I was asleep.",
      adapted_pressed: { calm: ["남편이 제 수면제를 가져다 먹곤 했어요. 그날도 그랬을 거예요."] },
      cracked_pressed: { calm: ["약을 안 먹었다고 했지만 제 약을 가져갔을 수 있겠네요. 저는 자고 있었어요."] },
    },
    {
      id: 'neighbor',
      name_ko: '이웃 진술',
      name_en: 'Neighbour’s statement',
      shows: 'The neighbour who called emergency services says that around 1:10 a.m., well before the fire, she heard the shed door and saw a woman’s figure walking from the shed to the house with a flashlight.',
      detail_ko: '119에 신고한 이웃의 진술. 화재 훨씬 전인 새벽 1시 10분쯤 창고 문소리가 났고, 손전등을 든 여자가 창고에서 집으로 걸어가는 걸 봤다.',
      examples: ['이웃이 1시 10분에 손전등 든 여자가 창고에서 집으로 가는 걸 봤대요.', '새벽 1시에 창고 문소리를 들었다는 이웃 진술이 있어요.', '2시 반에 깼다면서요. 1시 10분에 창고에는 누가 있었죠?'],
      breaks: 'night',
      contradicts: ["initial", "adapt:toxicology", "crack:toxicology"],
      crack: '…그 집 아주머니요? 그분 눈이 안 좋으세요. 1시에 제가… 아니, 화장실에 갔다가 마당에 나갔을 수는 있어요. 창고는 아니에요. 창고는… 열쇠가 없다니까요.',
      adapt: '아, 그 시간에 한 번 깼어요. 남편이 없길래 마당에 나가서 창고 쪽을 봤어요. 불이 켜져 있길래 또 술 마시나 보다 하고 들어와서 다시 잤어요.',
      adapted_statement_en: 'I woke once around 1 a.m., saw the shed light on from the yard, assumed he was drinking, and went back to sleep.',
      repeat: '이웃 진술은 아까 얘기했잖아요.',
      cracked_statement_en: "I now admit I may have gone into the yard around 1 a.m. after using the bathroom, but deny entering the shed or having a key.",
      adapted_pressed: { calm: ["1시쯤 한 번 깨서 마당에서 창고 불을 보고 다시 잤어요."] },
      cracked_pressed: { calm: ["1시에 마당에 나갔을 수는 있어요. 창고 안에는 안 들어갔어요."] },
    },
    {
      id: 'accelerant',
      name_ko: '화재 감식 결과',
      name_en: 'Fire investigation report',
      shows: 'The fire investigation found kerosene residue on the shed floor and door threshold in a pour pattern, no fault in the heater or wiring, and the door bolted from outside.',
      detail_ko: '창고 바닥과 문턱에서 부은 흔적 형태의 등유 성분이 검출됐다. 난로와 배선에 결함이 없었고, 문은 바깥에서 빗장이 걸려 있었다.',
      examples: ['감식 결과 바닥에서 등유가 나왔어요. 누전이 아니라.', '창고 문이 바깥에서 잠겨 있었어요. 안에서는 열 수 없게.', '난로에는 결함이 없었다고 감식이 나왔어요.'],
      breaks: 'shed',
      contradicts: ["initial"],
      crack: '…등유요. 창고에 등유통이 있었어요. 낚시 갈 때 쓰는… 그게 쏟아졌겠죠. 문은… 남편이 바람에 안 열리게… (목소리가 잦아든다) …밖에서요?',
      adapt: '창고에 등유통이 있었어요. 낚시 가서 쓰는 거요. 그게 쏟아진 데 난로 불이 붙었나 보죠. 문 빗장은 바람 때문에 남편이 걸어 두곤 했어요.',
      adapted_statement_en: 'There was a kerosene can in the shed for fishing trips; it must have spilled near the heater. My husband often bolted the door against the wind.',
      repeat: '감식 얘기는 이미 했어요.',
      cracked_statement_en: "I suggest spilled fishing kerosene caused the fire, but cannot explain why the shed was bolted from outside.",
      adapted_pressed: { calm: ["등유통이 쏟아졌을 거예요. 남편이 바람 때문에 빗장을 걸곤 했어요."] },
      cracked_pressed: { calm: ["등유통은 있었어요. 하지만 밖에서 걸린 빗장은 설명 못 하겠어요."] },
    },
    {
      id: 'messages',
      name_ko: '남편의 문자와 상담 기록',
      name_en: 'Husband’s messages and counselling record',
      shows: 'Messages from the husband to his brother in August: gambling debts of 300 million won, "she says she will leave"; and a record of the suspect consulting a divorce lawyer on 22 August.',
      detail_ko: '8월에 남편이 동생에게 보낸 문자: 도박 빚 3억, "그 사람이 떠나겠다고 한다". 정서연이 8월 22일 이혼 전문 변호사와 상담한 기록.',
      examples: ['남편이 동생한테 도박 빚 3억이라고 문자했어요. 당신이 떠나겠다고 했다고요.', '8월 22일에 이혼 변호사 상담하셨죠?', '사이가 좋았다면서요. 이혼 상담 기록이 있는데.'],
      breaks: 'marriage',
      contradicts: ["initial"],
      crack: '…(눈을 감는다) 이혼 상담은… 했어요. 빚이 3억이 아니라 4억이었어요. 집도 넘어가게 생겼고요. 근데 떠나지 않았어요. 떠나지 않았다고요. 끝까지 옆에 있었어요.',
      adapt: '…솔직히 사이가 좋지만은 않았어요. 남편 빚 때문에 많이 싸웠고, 상담도 받아 봤어요. 근데 그런 부부가 한둘인가요.',
      adapted_statement_en: 'The marriage was strained by my husband’s debts; we fought and I once consulted a lawyer, like many couples.',
      repeat: '이혼 상담 얘기는 이미 했어요.',
      cracked_statement_en: "I admit consulting a divorce lawyer and say the debts were 400 million won, but insist I never left my husband.",
      adapted_pressed: { calm: ["빚 때문에 싸웠고 이혼 상담도 받았어요."] },
      cracked_pressed: { calm: ["이혼 상담은 했어요. 빚은 4억이었지만 저는 떠나지 않았어요."] },
    },
    {
      id: 'key',
      name_ko: '창고 열쇠 복제 기록',
      name_en: 'Key-cutting record',
      shows: 'A locksmith’s log shows a duplicate of the shed padlock key was cut on 10 September and paid for with the suspect’s card.',
      detail_ko: '열쇠 가게 장부. 9월 10일 창고 자물쇠 열쇠를 복제했고, 정서연 카드로 결제됐다.',
      examples: ['9월 10일에 창고 열쇠를 복제하셨네요. 카드 결제 기록이 있어요.', '열쇠가 없다면서요. 열쇠 가게 장부에는 당신 카드가 찍혀 있는데.', '창고 자물쇠 열쇠 복제, 설명해 보세요.'],
      breaks: 'shed',
      contradicts: ["initial"],
      crack: '…열쇠는… 남편이 잃어버려서 제가 대신 맞춰 준 거예요. 제가 갖고 있던 건 아니에요. 아까 없다고 한 건… 제 열쇠가 없다는 뜻이었어요. 그 열쇠는 남편한테 줬어요. …줬다고요.',
      adapt: '열쇠는 남편이 잃어버려서 제가 하나 맞춰 준 거예요. 제가 쓰려고 만든 게 아니에요.',
      adapted_statement_en: 'I had a spare shed key cut for my husband after he lost his; it was not for me.',
      repeat: '열쇠 얘기는 했잖아요.',
      cracked_statement_en: "I admit having a shed key copied for my husband after he lost his, but claim I gave it to him and kept none myself.",
      adapted_pressed: { calm: ["남편이 잃어버려서 대신 맞춰 준 열쇠예요."] },
      cracked_pressed: { calm: ["복제한 적 없다는 건 잘못 말했어요. 남편 대신 맞춰서 줬어요."] },
    },
    {
      id: 'alarm',
      name_ko: '화재경보기 배터리',
      name_en: 'Smoke alarm battery',
      shows: 'The shed’s smoke alarm had a dead battery; the manufacturer’s label shows it expired two years ago.',
      detail_ko: '창고 화재경보기의 배터리가 방전돼 있었다. 제조사 표시로는 2년 전에 수명이 끝났다.',
      examples: ['경보기 배터리가 방전돼 있었어요.', '화재경보기가 2년 전에 수명이 끝났더군요.'],
      breaks: null,
      contradicts: [],
      crack: '',
      adapt: '',
      repeat: '경보기 얘기는 했잖아요.',
      deflect: '경보기요… 남편이 관리했어요. 그게 울렸으면 살았을까요. …그건 저도 매일 생각해요.',
    },
  ],
  endings: {
    confession: [
      '…네. 제가 그랬어요.',
      '4억이었어요. 이번 달에 집이 경매로 넘어가게 돼 있었고, 그 사람은 또 빌리러 다녔어요. 떠나겠다고 하니까 저를 벽에 밀쳤어요. 두 번째였어요. 8월에 증액 서류를 쓰면서 이미 결정한 것 같아요. 그날 밤 술에 약을 탔고, 잠든 걸 창고에 옮겼어요. 등유를 붓고 문을 걸고… 집에 들어와서 1시간을 앉아 있었어요.',
      '보험금은 신청 안 했어요. 못 하겠더라고요. 이제 다 말했어요. 변호사는… 부탁드립니다.',
    ],
    tainted: ['…그래요. 제가 했어요. 그렇게 쓰세요.', '(더 이상 아무 말도 하지 않는다)'],
    lawyer: '여기서 끝내죠. 변호사 선임 전에는 한마디도 하지 않겠습니다. 형사님 방식은 기록에 남을 거예요.',
    timeout: '장례 뒤처리가 남아 있어서요. 필요하면 변호사를 통해 연락 주세요.',
  },
};

export const CASES: readonly CaseFile[] = [convenience, hitrun, warehouse];

export function caseById(id: string): CaseFile | undefined {
  return CASES.find((file) => file.id === id);
}

/** Resolve a topic-local account id for UI and server alike; no inference or game rules here. */
export function statementFor(file: CaseFile, topicId: string, statementId: string) {
  const topic = file.topics.find((t) => t.id === topicId);
  if (!topic) return undefined;
  if (statementId === 'initial') return { statement: topic.statement, statement_en: topic.statement_en, pressed: topic.pressed };
  const item = file.evidence.find((e) => e.breaks === topicId &&
    (statementId === `adapt:${e.id}` || statementId === `crack:${e.id}`));
  if (!item) return undefined;
  const adapted = statementId === `adapt:${item.id}`;
  const statement_en = adapted ? item.adapted_statement_en : item.cracked_statement_en;
  const pressed = adapted ? item.adapted_pressed : item.cracked_pressed;
  if (!statement_en || !pressed?.calm?.length) return undefined;
  return { statement: adapted ? item.adapt : item.crack, statement_en, pressed };
}
