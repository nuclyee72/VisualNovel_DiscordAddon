import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { SOCKET_EVENTS, hasExplicitExpressionTag, classifyEmotion } from '@vn-trpg/shared';
import { Session } from './models/Session';
import { SessionLog } from './models/SessionLog';
import { Character } from './models/Character';
import { User, IUser } from './models/User';
import { isGuildMember } from './middleware/auth';

interface AuthenticatedSocket extends Socket {
  discordId?: string;
  userName?: string;
  isBotConnection?: boolean;
  joinedSessionId?: string;
}

// vn_token 쿠키는 httpOnly라 브라우저 JS(document.cookie)에서 읽을 수 없다.
// 소켓 핸드셰이크 요청에는 쿠키가 자동으로 실려오므로 서버에서 직접 파싱한다.
function parseCookies(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  cookieHeader.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  });
  return result;
}

// 소켓 이벤트 핸들러를 감싸서, 잘못된 payload 등으로 인한 예외가 unhandled rejection으로
// 새지 않고 로그만 남긴 채 조용히 무시되도록 한다 (다른 이벤트/연결에 영향 없음).
function safe<T>(fn: (payload: T) => Promise<void> | void) {
  return async (payload: T) => {
    try {
      await fn(payload);
    } catch (err) {
      console.error('[Socket] Handler error:', err);
    }
  };
}

// 봇 쪽 activeSessions 캐시가 (웹 대시보드에서 세션이 종료되는 등의 이유로) 오래된 값을
// 들고 있을 수 있으므로, 마스터 이벤트는 매번 서버에서 세션 상태를 다시 확인한다.
async function isActiveSession(sessionId: string): Promise<boolean> {
  const session = await Session.findOne({ sessionId }).select('status').lean();
  return !!session && session.status === 'active';
}

export function initSocketIO(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: ['http://localhost:3000', process.env.FRONTEND_URL || ''].filter(Boolean),
      credentials: true,
    },
  });

  // ── 인증 미들웨어 ──────────────────────────────────────────
  io.use((socket: AuthenticatedSocket, next) => {
    const botSecret = socket.handshake.auth?.botSecret as string | undefined;

    // 봇 연결 인증
    if (botSecret && botSecret === process.env.BOT_SECRET) {
      socket.isBotConnection = true;
      return next();
    }

    // 일반 유저 JWT 인증 — httpOnly 쿠키는 핸드셰이크 요청 헤더에서 직접 읽는다
    const cookies = parseCookies(socket.handshake.headers.cookie);
    const token = cookies['vn_token'];

    if (!token) {
      return next(new Error('Authentication error: No token'));
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
        discordId: string;
        userName: string;
      };
      socket.discordId = payload.discordId;
      socket.userName = payload.userName;
      next();
    } catch {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // ── 연결 핸들러 ────────────────────────────────────────────
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(
      `[Socket] Connected: ${socket.id} | ` +
      `${socket.isBotConnection ? 'BOT' : socket.userName}`
    );

    // 세션 룸 입장
    socket.on(SOCKET_EVENTS.CLIENT_JOIN_SESSION, safe(async ({ sessionId }: { sessionId: string }) => {
      if (!sessionId || typeof sessionId !== 'string') return;
      const roomName = `session:${sessionId}`;

      // 세션 유효성 확인
      const session = await Session.findOne({ sessionId });
      if (!session || session.status === 'ended') {
        socket.emit('error', { message: '유효하지 않거나 종료된 세션입니다.' });
        return;
      }

      // 세션이 속한 디스코드 서버(길드)의 멤버인지 확인 (sessionId만 알면 아무나 들어와
      // 엿듣는 것을 방지) — 별도의 "참가" 절차 없이, 길드 멤버라면 링크만으로 바로 입장할 수 있다.
      let user: IUser | null = null;
      if (!socket.isBotConnection) {
        user = await User.findOne({ discordId: socket.discordId });
        if (!user || !user.guilds.includes(session.guildId)) {
          socket.emit('error', { message: '이 서버의 멤버만 세션에 참가할 수 있습니다.' });
          return;
        }

        // 처음 접속하는 참가자라면 그 자리에서 자동으로 참가 처리한다 (지연 참가).
        const alreadyParticipant = session.participants.some((p) => p.discordId === socket.discordId);
        if (!alreadyParticipant) {
          session.participants.push({
            discordId: socket.discordId!,
            userName: socket.userName!,
            avatarUrl: user.avatar || '',
            role: 'player',
            joinedAt: new Date(),
          });
          try {
            await session.save();
          } catch (err) {
            // 동시 접속 경합으로 인한 저장 실패는 무시 — 다음 재연결 시 다시 시도된다.
            console.error('[Socket] Failed to save lazy-join participant:', err);
          }
          await SessionLog.updateOne(
            { sessionId },
            { $addToSet: { participants: socket.userName } }
          );
        }
      }

      socket.join(roomName);
      socket.joinedSessionId = sessionId;
      console.log(`[Socket] ${socket.userName || 'BOT'} joined room: ${roomName}`);

      // 입장 알림 브로드캐스트 (봇 연결 제외)
      if (!socket.isBotConnection) {
        const avatarUrl = user?.avatar || '';

        // 캐릭터 이미지 데이터 로드 — 캐릭터 목록에서 명시적으로 "선택"한 캐릭터가
        // 있으면 그걸 쓰고, 없거나(한 번도 선택 안 함) 선택된 캐릭터가 이미
        // 삭제된 경우에는 예전처럼 첫 번째 캐릭터로 대체한다.
        let character = user?.activeCharacterId
          ? await Character.findOne({ _id: user.activeCharacterId, ownerId: socket.discordId }).lean()
          : null;
        if (!character) {
          character = await Character.findOne({ ownerId: socket.discordId }).lean();
        }

        // 참여자 입장 이벤트 브로드캐스트
        io.to(roomName).emit(SOCKET_EVENTS.VN_PARTICIPANT_JOIN, {
          sessionId,
          discordId: socket.discordId,
          userName: socket.userName,
          avatarUrl,
          role: 'player',
          // 캐릭터 이미지 데이터 첨부
          baseImageUrl: character?.baseImageUrl || null,
          anchorX: character?.anchorX ?? 50,
          anchorY: character?.anchorY ?? 10,
          images: character?.images?.map(img => ({ tag: img.tag, url: img.url })) || [],
        });

        socket.to(roomName).emit(SOCKET_EVENTS.VN_SYSTEM_MESSAGE, {
          sessionId,
          text: `${socket.userName}님이 입장했습니다.`,
          level: 'info',
          timestamp: Date.now(),
        });
      }
    }));

    // ── 봇 → 전체 브로드캐스트 이벤트들 ──────────────────────

    socket.on(SOCKET_EVENTS.MASTER_BACKGROUND, safe(async (payload: any) => {
      if (!socket.isBotConnection || !payload?.sessionId) return;
      if (!(await isActiveSession(payload.sessionId))) return;
      const roomName = `session:${payload.sessionId}`;
      io.to(roomName).emit(SOCKET_EVENTS.VN_BACKGROUND, payload);
      await appendLog(payload.sessionId, {
        timestamp: Date.now(),
        type: 'background',
        content: `배경 전환: ${payload.name}`,
        metadata: { url: payload.url },
      });
    }));

    socket.on(SOCKET_EVENTS.MASTER_BGM, safe(async (payload: any) => {
      if (!socket.isBotConnection || !payload?.sessionId) return;
      if (!(await isActiveSession(payload.sessionId))) return;
      const roomName = `session:${payload.sessionId}`;
      io.to(roomName).emit(SOCKET_EVENTS.VN_BGM, payload);
      await appendLog(payload.sessionId, {
        timestamp: Date.now(),
        type: 'bgm',
        content: `🎵 BGM 전환: ${payload.name}`,
        metadata: { url: payload.url },
      });
    }));

    socket.on(SOCKET_EVENTS.MASTER_DICE, safe(async (payload: any) => {
      if (!socket.isBotConnection || !payload?.sessionId) return;
      if (!(await isActiveSession(payload.sessionId))) return;
      const roomName = `session:${payload.sessionId}`;
      io.to(roomName).emit(SOCKET_EVENTS.VN_DICE, payload);
      await appendLog(payload.sessionId, {
        timestamp: Date.now(),
        type: 'dice',
        speaker: payload.userName,
        speakerId: payload.discordId,
        content: `🎲 ${payload.userName} - ${payload.formula}: ${payload.total}`,
        metadata: { rolls: payload.rolls, modifier: payload.modifier },
      });
    }));

    socket.on(SOCKET_EVENTS.MASTER_STATUS, safe(async (payload: any) => {
      if (!socket.isBotConnection || !payload?.sessionId) return;
      if (!(await isActiveSession(payload.sessionId))) return;
      const roomName = `session:${payload.sessionId}`;
      io.to(roomName).emit(SOCKET_EVENTS.VN_STATUS_UPDATE, payload);

      // 변경된 스탯을 캐릭터 문서에 실제로 반영 (다음 /hp, /mp 호출이 최신 값을 읽도록)
      if ((payload.field === 'hp' || payload.field === 'mp') && payload.currentValue >= 0) {
        await Character.updateOne(
          { ownerId: payload.discordId },
          { $set: { [`stats.${payload.field}.current`]: payload.currentValue } }
        );
      }

      await appendLog(payload.sessionId, {
        timestamp: Date.now(),
        type: 'status',
        content: `${payload.field.toUpperCase()} 변경: ${payload.delta > 0 ? '+' : ''}${payload.delta} → ${payload.currentValue}/${payload.maxValue}`,
        metadata: payload,
      });
    }));

    socket.on(SOCKET_EVENTS.MASTER_DIALOGUE, safe(async (payload: any) => {
      if (!socket.isBotConnection || !payload?.sessionId) return;
      if (!(await isActiveSession(payload.sessionId))) return;
      const roomName = `session:${payload.sessionId}`;
      io.to(roomName).emit(SOCKET_EVENTS.VN_DIALOGUE, payload);
      io.to(roomName).emit(SOCKET_EVENTS.VN_SPEAKER, {
        sessionId: payload.sessionId,
        discordId: payload.speakerDiscordId,
        name: payload.speakerName,
        characterId: payload.characterId,
      });
      await appendLog(payload.sessionId, {
        timestamp: Date.now(),
        type: 'dialogue',
        speaker: payload.speakerName,
        speakerId: payload.speakerDiscordId,
        content: payload.text,
      });

      // ── 표정 자동 감지 ──────────────────────────────────
      // 이모지/수동 명령어로 이미 표정이 지정된 대사는 그 지정이 우선하므로 건너뛴다.
      if (typeof payload.text === 'string' && !hasExplicitExpressionTag(payload.text)) {
        const speaker = await User.findOne({ discordId: payload.speakerDiscordId })
          .select('expressionAutoDetect')
          .lean();
        if (speaker?.expressionAutoDetect) {
          const tag = classifyEmotion(payload.text);
          io.to(roomName).emit(SOCKET_EVENTS.VN_EXPRESSION, {
            sessionId: payload.sessionId,
            discordId: payload.speakerDiscordId,
            tag,
          });
          await appendLog(payload.sessionId, {
            timestamp: Date.now(),
            type: 'expression',
            speakerId: payload.speakerDiscordId,
            content: `표정 자동 감지: ${tag}`,
          });
        }
      }
    }));

    socket.on(SOCKET_EVENTS.MASTER_EXPRESSION, safe(async (payload: any) => {
      if (!socket.isBotConnection || !payload?.sessionId) return;
      if (!(await isActiveSession(payload.sessionId))) return;
      const roomName = `session:${payload.sessionId}`;
      io.to(roomName).emit(SOCKET_EVENTS.VN_EXPRESSION, payload);
      await appendLog(payload.sessionId, {
        timestamp: Date.now(),
        type: 'expression',
        speakerId: payload.discordId,
        content: `표정 변경: ${payload.tag}`,
      });
    }));

    socket.on(SOCKET_EVENTS.MASTER_SYSTEM, safe(async (payload: any) => {
      if (!socket.isBotConnection || !payload?.sessionId) return;
      if (!(await isActiveSession(payload.sessionId))) return;
      const roomName = `session:${payload.sessionId}`;
      io.to(roomName).emit(SOCKET_EVENTS.VN_SYSTEM_MESSAGE, payload);
    }));

    // ── 브라우저 VAD 발언 감지 (클라이언트 → 서버 → 룸 전체) ──
    socket.on(SOCKET_EVENTS.VOICE_SPEAKING, safe((payload: {
      sessionId: string;
      isSpeaking: boolean;
    }) => {
      if (socket.isBotConnection || !payload?.sessionId) return;
      const roomName = `session:${payload.sessionId}`;

      if (payload.isSpeaking) {
        // 발언 시작 → 발언자 하이라이트
        io.to(roomName).emit(SOCKET_EVENTS.VN_SPEAKER, {
          sessionId: payload.sessionId,
          discordId: socket.discordId,
          name: socket.userName,
        });
      } else {
        // 발언 종료 → 발언자 null로 (하이라이트 해제)
        io.to(roomName).emit(SOCKET_EVENTS.VN_SPEAKER, {
          sessionId: payload.sessionId,
          discordId: null,
          name: null,
        });
      }
    }));

    // ── STT 텍스트 전송 (클라이언트 → 서버 → 방 전체) ───────
    socket.on(SOCKET_EVENTS.STT_TRANSCRIPT, safe(async (payload: {
      sessionId: string;
      text: string;
      isFinal: boolean;
    }) => {
      if (socket.isBotConnection || !payload?.sessionId) return;
      const roomName = `session:${payload.sessionId}`;

      // STT 결과를 대사로 브로드캐스트
      const dialoguePayload = {
        sessionId: payload.sessionId,
        speakerDiscordId: socket.discordId!,
        speakerName: socket.userName!,
        text: payload.text,
        timestamp: Date.now(),
        isStt: true,
        isFinal: payload.isFinal,
      };
      socket.to(roomName).emit(SOCKET_EVENTS.VN_DIALOGUE, dialoguePayload);

      // 최종 결과만 로그 저장
      if (payload.isFinal) {
        await appendLog(payload.sessionId, {
          timestamp: Date.now(),
          type: 'dialogue',
          speaker: socket.userName,
          speakerId: socket.discordId,
          content: payload.text,
          metadata: { source: 'stt' },
        });
      }
    }));

    // ── 연결 해제 ──────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
      if (!socket.isBotConnection && socket.joinedSessionId && socket.discordId) {
        const roomName = `session:${socket.joinedSessionId}`;
        socket.to(roomName).emit(SOCKET_EVENTS.VN_PARTICIPANT_LEAVE, {
          sessionId: socket.joinedSessionId,
          discordId: socket.discordId,
        });
      }
    });
  });

  return io;
}

// 로그 엔트리 추가 헬퍼
async function appendLog(
  sessionId: string,
  entry: {
    timestamp: number;
    type: 'dialogue' | 'dice' | 'bgm' | 'background' | 'status' | 'system' | 'expression';
    speaker?: string;
    speakerId?: string;
    content: string;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await SessionLog.updateOne(
      { sessionId },
      { $push: { entries: entry } },
      { upsert: false }
    );
  } catch (e) {
    console.error('[Log] Failed to append log entry:', e);
  }
}
