import { Message } from 'discord.js';
import { socket, activeSessions } from '../index';
import { SOCKET_EVENTS, EMOJI_EXPRESSION_MAP } from '../../../packages/shared/src/index';

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

  // ── 수동 표정 명령어 감지: !웃음, !슬픔 등 ─────────────────
  const manualExpressionMatch = text.match(/^!(\S+)/);
  if (manualExpressionMatch) {
    const tag = `#${manualExpressionMatch[1]}`;
    socket.emit(SOCKET_EVENTS.MASTER_EXPRESSION, {
      sessionId,
      discordId,
      tag,
    });
    // 명령어만 있는 경우 대사 전송 안 함
    if (text === manualExpressionMatch[0]) return;
  }

  // ── 대사 텍스트 → 웹 뷰어로 전송 ──────────────────────────
  socket.emit(SOCKET_EVENTS.MASTER_DIALOGUE, {
    sessionId,
    speakerDiscordId: discordId,
    speakerName: userName,
    text,
    timestamp: Date.now(),
  });
}
