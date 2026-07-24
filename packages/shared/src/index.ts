// ============================================================
// 공통 Socket.IO 이벤트 상수
// ============================================================

export const SOCKET_EVENTS = {
  // 서버 → 클라이언트
  VN_DIALOGUE: 'vn:dialogue',
  VN_SPEAKER: 'vn:speaker',
  VN_BACKGROUND: 'vn:background',
  VN_BGM: 'vn:bgm',
  VN_EXPRESSION: 'vn:expression',
  VN_DICE: 'vn:dice',
  VN_STATUS_UPDATE: 'vn:status_update',
  VN_SYSTEM_MESSAGE: 'vn:system_message',
  VN_PARTICIPANT_JOIN: 'vn:participant_join',
  VN_PARTICIPANT_LEAVE: 'vn:participant_leave',

  // 클라이언트 → 서버
  STT_TRANSCRIPT: 'stt:transcript',
  CLIENT_READY: 'client:ready',
  CLIENT_JOIN_SESSION: 'client:join_session',

  // 음성 감지 (브라우저 VAD)
  VOICE_SPEAKING: 'voice:speaking',

  // 봇(마스터) → 서버 (내부)
  MASTER_BACKGROUND: 'master:background',
  MASTER_BGM: 'master:bgm',
  MASTER_DICE: 'master:dice',
  MASTER_STATUS: 'master:status',
  MASTER_DIALOGUE: 'master:dialogue',
  MASTER_EXPRESSION: 'master:expression',
  MASTER_SYSTEM: 'master:system',
} as const;

// ============================================================
// 공통 타입 정의
// ============================================================

export type DialoguePayload = {
  sessionId: string;
  speakerDiscordId: string;
  speakerName: string;
  text: string;
  characterId?: string;
  timestamp: number;
};

export type SpeakerPayload = {
  sessionId: string;
  discordId: string;
  name: string;
  characterId?: string;
};

export type BackgroundPayload = {
  sessionId: string;
  name: string;       // e.g. "던전", "마을"
  url: string;        // 이미지 URL
};

export type BGMPayload = {
  sessionId: string;
  name: string;           // e.g. "전투", "평화"
  youtubeVideoId: string; // YouTube Video ID (e.g. "dQw4w9WgXcQ")
  volume?: number;        // 0~1, 기본 0.5
  startSeconds?: number;  // 재생 시작 지점(초)
};

// 브라우저 VAD → 서버로 발언 상태 전송
// 주의: 서버(server/src/socket.ts의 VOICE_SPEAKING 핸들러)는 클라이언트가 보낸
// discordId를 신뢰하지 않고 인증된 socket.discordId를 사용하므로, 이 타입에는
// discordId를 포함하지 않는다 (클라이언트가 굳이 보낼 필요도, 보낼 수단도 없음).
export type VoiceSpeakingPayload = {
  sessionId: string;
  isSpeaking: boolean;
};

// 세션 최대 참가자 수
export const MAX_SESSION_PARTICIPANTS = 10;

// 같은 화자가 연속으로 말할 때 새 대사창을 띄우지 않고 한 대사창에 줄바꿈으로
// 이어붙일 수 있는 최대 줄 수. 이 줄 수를 넘으면 새 대사창으로 분리된다.
export const MAX_MERGED_DIALOGUE_LINES = 10;

export type ExpressionPayload = {
  sessionId: string;
  discordId: string;
  tag: string;        // e.g. "#Happy", "#Sad"
};

export type DicePayload = {
  sessionId: string;
  discordId: string;
  userName: string;
  formula: string;    // e.g. "2d6+3"
  rolls: number[];    // 각 주사위 결과
  modifier: number;
  total: number;
  timestamp: number;
};

export type StatusUpdatePayload = {
  sessionId: string;
  discordId: string;
  field: 'hp' | 'mp' | 'custom';
  customField?: string;
  delta: number;
  currentValue: number;
  maxValue: number;
};

export type SystemMessagePayload = {
  sessionId: string;
  text: string;
  level: 'info' | 'warning' | 'error';
  timestamp: number;
};

export type ParticipantPayload = {
  sessionId: string;
  discordId: string;
  userName: string;
  avatarUrl: string;
  characterId?: string;
  role: 'master' | 'player';
};

// ============================================================
// 이모지 → 표정 태그 매핑
// ============================================================

export const EMOJI_EXPRESSION_MAP: Record<string, string> = {
  '😊': '#Happy', '😄': '#Happy', '😂': '#Happy', '🤣': '#Happy', '😁': '#Happy',
  '😢': '#Sad', '😭': '#Sad', '😥': '#Sad',
  '😡': '#Angry', '🤬': '#Angry', '😠': '#Angry',
  '😲': '#Surprised', '😱': '#Surprised', '😮': '#Surprised', '🤯': '#Surprised',
  '😳': '#Embarrassed', '🫣': '#Embarrassed',
  '😨': '#Scared', '😰': '#Scared',
  '🤔': '#Thinking', '🧐': '#Thinking',
  '😐': '#Neutral', '😶': '#Neutral',
  '✨': '#Custom',
};

// 이모지 또는 "!Happy" 같은 수동 명령어로 이미 표정이 명시적으로 지정된 텍스트인지 확인.
// 자동 표정 감지 기능은 이 경우 감지 결과를 무시하고 명시적 지정에 우선순위를 양보한다.
export function hasExplicitExpressionTag(text: string): boolean {
  for (const emoji of Object.keys(EMOJI_EXPRESSION_MAP)) {
    if (text.includes(emoji)) return true;
  }
  const manualMatch = text.match(/^!(\S+)/);
  if (manualMatch) {
    const candidate = `#${manualMatch[1]}`.toLowerCase();
    const validTags = Array.from(new Set(Object.values(EMOJI_EXPRESSION_MAP)));
    if (validTags.some((t) => t.toLowerCase() === candidate)) return true;
  }
  return false;
}

// ============================================================
// 텍스트 문맥 기반 감정(표정) 자동 분류
// — 외부 API나 사전학습 모델 없이, 아래 예문으로 직접 학습하는
//   가벼운 문자 bigram 나이브 베이즈 분류기 (모듈 로드 시 1회 학습, 이후 캐시)
// ============================================================

export const EMOTION_TAGS = [
  '#Happy', '#Sad', '#Angry', '#Surprised', '#Embarrassed', '#Scared', '#Thinking', '#Neutral',
] as const;
export type EmotionTag = typeof EMOTION_TAGS[number];

// 감정별 핵심 문장(필러 단어 없이 감정 자체를 담은 완결된 절). 오분류가 발견되면
// 해당 감정 배열에 비슷한 문장을 추가하는 것만으로 재학습(모듈 재시작)되므로,
// 키워드 목록을 고치는 것보다 훨씬 유연하게 정확도를 개선할 수 있다.
const CORE_CLAUSES: Record<EmotionTag, string[]> = {
  '#Happy': [
    '오늘 하루 행복했어', '드디어 성공했다', '너랑 있으면 즐거워', '생각보다 훨씬 좋은걸',
    '고마워, 덕분이야', '이보다 좋을 순 없지', '하하, 재밌다', '오랜만에 웃어보네',
    '최고의 하루였어', '다행이다, 잘됐어', '네가 있어서 든든해', '이겼다, 우리가 해냈어',
    '기분이 날아갈 것 같아', '눈물 날 만큼 좋아', '이런 날이 또 올까', '웃음이 멈추질 않아',
    '행운이 따라줬나 봐', '마음이 따뜻해지네', '함께해서 즐거웠어', '보람찬 하루였어',
  ],
  '#Sad': [
    '마음이 아파', '눈물이 나', '혼자 남겨진 기분이야', '다시는 못 만난다니 믿기지 않아',
    '마음이 텅 빈 것 같아', '그때를 생각하면 아직도 속상해', '미안해, 내 잘못이야', '이별은 언제나 힘들어',
    '눈물이 멈추질 않아', '주저앉고 싶어', '다 잃어버린 기분이야', '그가 떠났다는 게 슬퍼',
    '우울한 하루였어', '가슴이 먹먹해', '위로받고 싶어', '쓸쓸한 밤이야',
    '그리움이 밀려와', '마음 한구석이 시려', '혼자라는 게 서러워', '눈물을 참기 힘들어',
  ],
  '#Angry': [
    '화가 나서 못 참겠어', '말도 안 돼, 짜증나', '누가 이런 짓을 했는지 화가 치밀어', '그만 좀 해, 열받네',
    '배신자, 용서 못 해', '당장 나가', '이 상황이 짜증스러워', '감히 나를 속이다니, 분노가 치민다',
    '더는 못 참아, 폭발할 것 같아', '너 때문에 다 망쳤잖아', '그 말이 거슬려', '최악이야',
    '속이 부글부글 끓는다', '선을 넘었어', '어이가 없다', '참을 만큼 참았어',
    '이걸 가만두지 않겠어', '부아가 치민다', '울화통이 터진다', '속이 뒤집어진다',
  ],
  '#Surprised': [
    '헉, 믿을 수가 없어', '세상에, 이게 무슨 일이야', '설마 여기서 만날 줄이야', '어떻게 이런 일이 일어날 수 있지',
    '깜짝 놀랐잖아', '이럴 수가, 전혀 예상 못 했어', '말도 안 돼, 이게 사실이야', '이게 대체 무슨 상황이지',
    '갑자기 나타나서 놀랐잖아', '이렇게 될 줄은 몰랐어', '뜻밖이네', '그게 사실이었다니, 충격이야',
    '예상치 못한 전개야', '소름 돋을 정도로 놀랍다', '입이 다물어지지 않아', '눈을 의심했어',
    '이런 반전이 있을 줄이야', '심장이 철렁했어', '어안이 벙벙하다', '이게 꿈은 아니겠지',
  ],
  '#Embarrassed': [
    '부끄러워서 숨고 싶어', '그런 말은 민망한데', '얼굴이 화끈거려', '쑥스럽네',
    '아무한테도 말하지 마, 창피하니까', '그렇게 쳐다보니까 당황스러워', '실수해서 민망해', '다들 보는 앞에서 넘어지다니, 창피해',
    '이런 얘기 하려니까 부끄럽네', '얼굴이 빨개지네', '몸 둘 바를 모르겠어', '쥐구멍에 숨고 싶다',
    '괜히 민망해지네', '낯이 뜨겁다', '이거 좀 창피한데', '당황해서 말이 안 나와',
    '부끄러워서 고개를 못 들겠어',
  ],
  '#Scared': [
    '무서워서 다리가 떨려', '저 소리, 등골이 오싹해', '제발 살려줘, 무서워 죽겠어', '어둠 속에서 뭔가 움직이는 것 같아',
    '심장이 떨려서 움직일 수가 없어', '그 눈빛이 무서웠어', '소름 끼치는 기분이야', '혼자 있기 두려워',
    '이 느낌, 뭔가 잘못됐어', '가까이 오지 마, 겁나', '숨이 막힐 것 같아', '발이 얼어붙었어',
    '등에서 식은땀이 나', '떨리는 손을 멈출 수가 없어', '그림자만 봐도 겁이 나', '심장이 쿵 내려앉았어',
    '무서운 예감이 든다', '도망치고 싶어',
  ],
  '#Thinking': [
    '이걸 어떻게 해야 하지', '글쎄, 잘 모르겠는데', '잠깐, 생각해볼 시간이 필요해', '이 문제는 더 고민해봐야겠어',
    '궁금하네, 왜 그런 걸까', '흠, 다른 방법이 있을까', '어떡하지, 결정을 못 내리겠어', '곰곰이 생각해보니 이상한데',
    '뭘 선택해야 할지 모르겠어', '생각 좀 정리할게', '이유가 뭘까', '다시 한번 따져봐야겠어',
    '확신이 서질 않아', '고민이 깊어지네', '정리가 필요할 것 같아', '판단이 서질 않아',
    '다른 가능성은 없을까', '머리가 복잡하다',
  ],
  '#Neutral': [
    '알겠어', '그렇구나', '일단 가보자', '확인해볼게', '여기서 기다리고 있을게',
    '다음 마을로 이동하자', '장비를 점검해야겠어', '시간이 얼마 남지 않았어', '그건 나중에 얘기하자',
    '준비 다 됐어', '이쪽으로 와', '오늘은 여기까지 하자', '필요한 물건을 챙겼어', '다들 모였는지 확인해줘',
    '지도를 다시 살펴보자', '물자를 나눠서 들자', '다음 계획을 세워야겠어', '이 길로 가면 될 것 같아',
    '짐을 정리하자', '출발할 준비가 됐어',
  ],
};

// 문장 앞/뒤에 붙는 범용 표현. 감정과 무관하게 모든 감정 클래스에 "동일한 확률로" 섞이도록
// 생성 단계에서 공용으로 사용한다 — "진짜", "정말" 같은 강조어가 특정 감정 하나에만 몰려서
// 그 단어만으로 오분류를 유발하는 문제(나이브 베이즈의 데이터 편중 문제)를 데이터 자체를
// 고르게 만들어서 해소하기 위함이다.
const SHARED_PREFIXES = ['', '아, ', '음, ', '저기, ', '잠깐, ', '와, ', '그런데, ', '하아, ', '휴, ', '어우, ', '이야, '];
const SHARED_TRAILINGS = ['.', '!', '...', ' 정말이야.', ' 진짜로.', ' 완전.'];

// 핵심 문장 + 공용 접두/접미 표현을 조합해 학습 문장을 대량으로 만들어낸다(데이터 증강).
// 조합이 목표 개수보다 많으면 한쪽으로 쏠리지 않도록 균등 간격으로 표본을 추출한다.
function generateTrainingSentences(coreClauses: string[], targetCount: number): string[] {
  const candidates: string[] = [];
  for (const core of coreClauses) {
    for (const prefix of SHARED_PREFIXES) {
      for (const trailing of SHARED_TRAILINGS) {
        candidates.push(`${prefix}${core}${trailing}`);
      }
    }
  }

  const unique = Array.from(new Set(candidates));
  if (unique.length <= targetCount) return unique;

  const stride = unique.length / targetCount;
  const sampled: string[] = [];
  for (let i = 0; i < targetCount; i++) {
    sampled.push(unique[Math.floor(i * stride)]);
  }
  return sampled;
}

const TRAINING_EXAMPLES_PER_CLASS = 125; // 8개 감정 × 125 ≈ 1000문장

const TRAINING_DATA: Record<EmotionTag, string[]> = EMOTION_TAGS.reduce((acc, tag) => {
  acc[tag] = generateTrainingSentences(CORE_CLAUSES[tag], TRAINING_EXAMPLES_PER_CLASS);
  return acc;
}, {} as Record<EmotionTag, string[]>);

function extractBigrams(text: string): string[] {
  const clean = text.trim();
  if (clean.length < 2) return clean.length === 1 ? [clean] : [];
  const grams: string[] = [];
  for (let i = 0; i < clean.length - 1; i++) {
    grams.push(clean.slice(i, i + 2));
  }
  return grams;
}

interface EmotionModel {
  classPriors: Record<EmotionTag, number>;
  featureCounts: Record<EmotionTag, Map<string, number>>;
  totalFeaturesByClass: Record<EmotionTag, number>;
  vocabularySize: number;
}

function trainModel(): EmotionModel {
  const totalExamples = EMOTION_TAGS.reduce((sum, tag) => sum + TRAINING_DATA[tag].length, 0);
  const vocabulary = new Set<string>();
  const classPriors = {} as Record<EmotionTag, number>;
  const featureCounts = {} as Record<EmotionTag, Map<string, number>>;
  const totalFeaturesByClass = {} as Record<EmotionTag, number>;

  for (const tag of EMOTION_TAGS) {
    const examples = TRAINING_DATA[tag];
    classPriors[tag] = examples.length / totalExamples;

    const counts = new Map<string, number>();
    let total = 0;
    for (const example of examples) {
      for (const gram of extractBigrams(example)) {
        counts.set(gram, (counts.get(gram) ?? 0) + 1);
        vocabulary.add(gram);
        total += 1;
      }
    }
    featureCounts[tag] = counts;
    totalFeaturesByClass[tag] = total;
  }

  return { classPriors, featureCounts, totalFeaturesByClass, vocabularySize: vocabulary.size };
}

let cachedModel: EmotionModel | null = null;
function getModel(): EmotionModel {
  if (!cachedModel) cachedModel = trainModel();
  return cachedModel;
}

// 대사 텍스트를 8가지 감정 태그 중 가장 유사한 것으로 분류한다 (나이브 베이즈, 라플라스 스무딩).
// 어떤 학습 예문과도 문자 bigram이 겹치지 않으면 자연스럽게 "#Neutral" 쪽 확률이 우세해진다.
export function classifyEmotion(text: string): EmotionTag {
  const model = getModel();
  const grams = extractBigrams(text);
  if (grams.length === 0) return '#Neutral';

  let bestTag: EmotionTag = '#Neutral';
  let bestScore = -Infinity;

  for (const tag of EMOTION_TAGS) {
    const counts = model.featureCounts[tag];
    const totalFeatures = model.totalFeaturesByClass[tag];
    let score = Math.log(model.classPriors[tag]);

    for (const gram of grams) {
      const count = counts.get(gram) ?? 0;
      score += Math.log((count + 1) / (totalFeatures + model.vocabularySize));
    }

    if (score > bestScore) {
      bestScore = score;
      bestTag = tag;
    }
  }

  return bestTag;
}

// ============================================================
// 주사위 파서
// ============================================================

export type DiceParseResult = {
  formula: string;
  diceCount: number;
  diceSides: number;
  modifier: number;
};

export function parseDiceFormula(formula: string): DiceParseResult | null {
  // 지원 형식: d20, 2d6, 2d6+3, d8-1
  const match = formula.trim().match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return null;

  return {
    formula,
    diceCount: parseInt(match[1] || '1'),
    diceSides: parseInt(match[2]),
    modifier: parseInt(match[3] || '0'),
  };
}

export function rollDice(parsed: DiceParseResult): DicePayload['rolls'] {
  const rolls: number[] = [];
  for (let i = 0; i < parsed.diceCount; i++) {
    rolls.push(Math.floor(Math.random() * parsed.diceSides) + 1);
  }
  return rolls;
}

// ============================================================
// 오토모드 타이밍 계산
// ============================================================

export const AUTO_DELAY_PER_CHAR_MS = 150;
export const AUTO_MIN_DELAY_MS = 2000;

export function calcAutoDelay(text: string, speed: number = 1.0): number {
  const base = Math.max(text.length * AUTO_DELAY_PER_CHAR_MS, AUTO_MIN_DELAY_MS);
  return Math.floor(base / speed);
}

// ============================================================
// 배경/BGM 프리셋
// ============================================================

export const BACKGROUND_PRESETS = [
  { name: '마을', key: 'town' },
  { name: '던전', key: 'dungeon' },
  { name: '숲', key: 'forest' },
  { name: '전투', key: 'battle' },
  { name: '실내', key: 'indoor' },
  { name: '항구', key: 'harbor' },
  { name: '성', key: 'castle' },
  { name: '황야', key: 'wasteland' },
] as const;

// BGM 프리셋은 YouTube Video ID로 관리
// 실제 ID는 마스터가 대시보드에서 설정
export const BGM_PRESETS: Array<{ name: string; key: string; defaultYoutubeId: string }> = [
  { name: '평화', key: 'peaceful', defaultYoutubeId: '' },
  { name: '전투', key: 'battle', defaultYoutubeId: '' },
  { name: '슬픔', key: 'sad', defaultYoutubeId: '' },
  { name: '긴장', key: 'tense', defaultYoutubeId: '' },
  { name: '축제', key: 'festival', defaultYoutubeId: '' },
  { name: '신비', key: 'mystic', defaultYoutubeId: '' },
  { name: '던전', key: 'dungeon', defaultYoutubeId: '' },
  { name: '보스전', key: 'boss', defaultYoutubeId: '' },
];

// YouTube Video ID 추출 헬퍼
export function extractYoutubeId(urlOrId: string): string | null {
  // 이미 ID 형식인 경우
  if (/^[a-zA-Z0-9_-]{11}$/.test(urlOrId)) return urlOrId;
  // URL에서 추출
  const match = urlOrId.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}
