import { Message } from 'discord.js';
import { socket, activeSessions } from '../state';
import { SOCKET_EVENTS, EMOJI_EXPRESSION_MAP } from '@vn-trpg/shared';

// 대사 릴레이 길이 제한 (너무 긴 텍스트가 VN 화면을 깨뜨리는 것을 방지)
const MAX_DIALOGUE_LENGTH = 1000;

// 유효한 표정 태그 목록 (EMOJI_EXPRESSION_MAP의 값들과 동일한 캐노니컬 태그 집합)
const VALID_EXPRESSION_TAGS: string[] = Array.from(new Set(Object.values(EMOJI_EXPRESSION_MAP)));

// "!Happy" 같은 입력을 대소문자 구분 없이 캐노니컬 태그(`#Happy`)로 변환한다.
// 허용 목록에 없는 단어(예: "!important")는 null을 반환해 일반 대사로 취급되게 한다.
function resolveManualExpressionTag(word: string): string | null {
  const candidate = `#${word}`.toLowerCase();
  return VALID_EXPRESSION_TAGS.find((t) => t.toLowerCase() === candidate) ?? null;
}

export async function handleMessageCreate(message: Message) {
  // 봇 메시지 무시
  if (message.author.bot) return;
  // DM 무시
  if (!message.guildId) return;
  // 슬래시 커맨드 무시
  if (message.content.startsWith('/')) return;

  const guildId = message.guildId;
  const sessionId = activeSessions.get(guildId);
  if (!sessionId) return;

  const text = message.content.trim();
  if (!text) return;

  const discordId = message.author.id;
  const userName = message.member?.displayName ?? message.author.username;

  // ── 이모지 → 표정 자동 감지 ────────────────────────────────
  let detectedExpression: string | null = null;

  for (const [emoji, tag] of Object.entries(EMOJI_EXPRESSION_MAP)) {
    if (text.includes(emoji)) {
      detectedExpression = tag;
      break; // 첫 번째 매칭만 사용
    }
  }

  if (detectedExpression) {
    socket.emit(SOCKET_EVENTS.MASTER_EXPRESSION, {
      sessionId,
      discordId,
      tag: detectedExpression,
    });
  }

  // ── 수동 표정 명령어 감지: !Happy, !Sad 등 (허용 목록에 있는 태그만) ──
  const manualExpressionMatch = text.match(/^!(\S+)/);
  if (manualExpressionMatch) {
    const resolvedTag = resolveManualExpressionTag(manualExpressionMatch[1]);
    if (resolvedTag) {
      socket.emit(SOCKET_EVENTS.MASTER_EXPRESSION, {
        sessionId,
        discordId,
        tag: resolvedTag,
      });
      // 명령어만 있는 경우 대사 전송 안 함
      if (text === manualExpressionMatch[0]) return;
    }
    // 허용 목록에 없는 단어(예: "!important note")는 표정 명령이 아니라
    // 일반 대사로 취급하고 아래로 흘려보낸다.
  }

  // ── 대사 텍스트 → 웹 뷰어로 전송 (과도하게 긴 텍스트는 잘라낸다) ──
  const relayText = text.length > MAX_DIALOGUE_LENGTH ? text.slice(0, MAX_DIALOGUE_LENGTH) : text;
  socket.emit(SOCKET_EVENTS.MASTER_DIALOGUE, {
    sessionId,
    speakerDiscordId: discordId,
    speakerName: userName,
    text: relayText,
    timestamp: Date.now(),
  });
}
