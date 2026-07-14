import { io as socketIO, Socket } from 'socket.io-client';

// index.ts와 커맨드/이벤트 파일들이 서로를 import하는 순환 참조를 피하기 위해
// 공유 상태(소켓, 세션 맵)를 별도 모듈로 분리한다.

// ── Socket.IO 연결 (봇 → 백엔드 서버) ────────────────────────
export const socket: Socket = socketIO(
  process.env.BACKEND_URL || 'http://localhost:4000',
  {
    auth: { botSecret: process.env.BOT_SECRET },
    reconnection: true,
    reconnectionDelay: 3000,
  }
);

socket.on('connect', () => {
  console.log(`[Bot Socket] Connected to backend: ${socket.id}`);
});

socket.on('disconnect', (reason) => {
  console.warn(`[Bot Socket] Disconnected: ${reason}`);
});

socket.on('connect_error', (err) => {
  console.error(`[Bot Socket] Connection error: ${err.message}`);
});

// ── 세션 추적 Map (guildId → sessionId) ──────────────────────
export const activeSessions = new Map<string, string>();
