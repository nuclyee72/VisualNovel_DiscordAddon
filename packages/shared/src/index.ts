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
export type VoiceSpeakingPayload = {
  sessionId: string;
  discordId: string;
  isSpeaking: boolean;
};

// 세션 최대 참가자 수
export const MAX_SESSION_PARTICIPANTS = 10;

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
