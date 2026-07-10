import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { SOCKET_EVENTS } from '../../packages/shared/src/index';
import { Session } from './models/Session';
import { SessionLog } from './models/SessionLog';
import { Character } from './models/Character';
import { User } from './models/User';

interface AuthenticatedSocket extends Socket {
  discordId?: string;
  userName?: string;
  isBotConnection?: boolean;
}

export function initSocketIO(httpServer: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_BACKEND_URL
        ? [process.env.NEXT_PUBLIC_BACKEND_URL, 'http://localhost:3000']
        : 'http://localhost:3000',
      credentials: true,
    },
  });

  // ── 인증 미들웨어 ──────────────────────────────────────────
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const botSecret = socket.handshake.auth?.botSecret as string | undefined;

    // 봇 연결 인증
    if (botSecret && botSecret === process.env.BOT_SECRET) {
      socket.isBotConnection = true;
      return next();
    }

    // 일반 유저 JWT 인증
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
    socket.on(SOCKET_EVENTS.CLIENT_JOIN_SESSION, async ({ sessionId }: { sessionId: string }) => {
      const roomName = `session:${sessionId}`;

      // 세션 유효성 확인
      const session = await Session.findOne({ sessionId });
      if (!session || session.status === 'ended') {
        socket.emit('error', { message: '유효하지 않거나 종료된 세션입니다.' });
        return;
      }

      socket.join(roomName);
      console.log(`[Socket] ${socket.userName || 'BOT'} joined room: ${roomName}`);

      // 입장 알림 브로드캐스트 (봇 연결 제외)
      if (!socket.isBotConnection) {
        // 유저의 아바타 정보
        const user = await User.findOne({ discordId: socket.discordId });
        const avatarUrl = user?.avatar || '';

        // 캐릭터 이미지 데이터 로드
        const character = await Character.findOne({ ownerId: socket.discordId }).lean();

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
    });

    // ── 봇 → 전체 브로드캐스트 이벤트들 ──────────────────────

    socket.on(SOCKET_EVENTS.MASTER_BACKGROUND, async (payload) => {
      if (!socket.isBotConnection) return;
      const roomName = `session:${payload.sessionId}`;
      io.to(roomName).emit(SOCKET_EVENTS.VN_BACKGROUND, payload);
      await appendLog(payload.sessionId, {
        timestamp: Date.now(),
        type: 'background',
        content: `배경 전환: ${payload.name}`,
        metadata: { url: payload.url },
      });
    });

    socket.on(SOCKET_EVENTS.MASTER_BGM, async (payload) => {
      if (!socket.isBotConnection) return;
      const roomName = `session:${payload.sessionId}`;
      io.to(roomName).emit(SOCKET_EVENTS.VN_BGM, payload);
      await appendLog(payload.sessionId, {
        timestamp: Date.now(),
        type: 'bgm',
        content: `🎵 BGM 전환: ${payload.name}`,
        metadata: { url: payload.url },
      });
    });

    socket.on(SOCKET_EVENTS.MASTER_DICE, async (payload) => {
      if (!socket.isBotConnection) return;
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
    });

    socket.on(SOCKET_EVENTS.MASTER_STATUS, async (payload) => {
      if (!socket.isBotConnection) return;
      const roomName = `session:${payload.sessionId}`;
      io.to(roomName).emit(SOCKET_EVENTS.VN_STATUS_UPDATE, payload);
      await appendLog(payload.sessionId, {
        timestamp: Date.now(),
        type: 'status',
        content: `${payload.field.toUpperCase()} 변경: ${payload.delta > 0 ? '+' : ''}${payload.delta} → ${payload.currentValue}/${payload.maxValue}`,
        metadata: payload,
      });
    });

    socket.on(SOCKET_EVENTS.MASTER_DIALOGUE, async (payload) => {
      if (!socket.isBotConnection) return;
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
    });

    socket.on(SOCKET_EVENTS.MASTER_EXPRESSION, async (payload) => {
      if (!socket.isBotConnection) return;
      const roomName = `session:${payload.sessionId}`;
      io.to(roomName).emit(SOCKET_EVENTS.VN_EXPRESSION, payload);
    });

    socket.on(SOCKET_EVENTS.MASTER_SYSTEM, async (payload) => {
      if (!socket.isBotConnection) return;
      const roomName = `session:${payload.sessionId}`;
      io.to(roomName).emit(SOCKET_EVENTS.VN_SYSTEM_MESSAGE, payload);
    });

    // ── 브라우저 VAD 발언 감지 (클라이언트 → 서버 → 룸 전체) ──
    socket.on(SOCKET_EVENTS.VOICE_SPEAKING, (payload: {
      sessionId: string;
      isSpeaking: boolean;
    }) => {
      if (socket.isBotConnection) return;
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
    });

    // ── STT 텍스트 전송 (클라이언트 → 서버 → 방 전체) ───────


    socket.on(SOCKET_EVENTS.STT_TRANSCRIPT, async (payload: {
      sessionId: string;
      text: string;
      isFinal: boolean;
    }) => {
      if (socket.isBotConnection) return;
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
    });

    // ── 연결 해제 ──────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
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
