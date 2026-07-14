import path from 'path';
import dotenv from 'dotenv';

// 다른 모듈(라우트, 소켓 등)이 import 시점에 process.env를 읽기 때문에
// dotenv 로드는 반드시 다른 모든 로컬 모듈 import보다 먼저 실행되어야 한다.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import dns from 'dns';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { Error as MongooseError } from 'mongoose';
import { createServer } from 'http';
import mongoose from 'mongoose';
import { initSocketIO } from './socket';

// 일부 네트워크 환경에서 Node의 기본 DNS 리졸버가 MongoDB Atlas의
// SRV 레코드(mongodb+srv://) 조회에 실패하는 문제 방지
dns.setServers(['8.8.8.8', '1.1.1.1']);

// 라우트 핸들러 내부에서 놓친 Promise 거부가 서버 프로세스 전체를
// 죽이지 않도록 하는 안전망 (근본 수정은 각 라우트의 asyncHandler)
process.on('unhandledRejection', (err) => {
  console.error('[UnhandledRejection]', err);
});

// 이 값들이 비어있으면 로그인/세션/봇 연동이 원인 불명으로 깊숙한 곳에서 실패하므로
// 부팅 시점에 명확히 실패시킨다.
if (!process.env.JWT_SECRET) {
  console.error('[Config] JWT_SECRET이 설정되지 않았습니다. .env를 확인해주세요.');
  process.exit(1);
}
if (!process.env.BOT_SECRET) {
  console.warn('[Config] BOT_SECRET이 설정되지 않았습니다. 디스코드 봇 연동이 동작하지 않습니다.');
}

// Routes
import authRoutes from './routes/auth';
import sessionRoutes from './routes/sessions';
import characterRoutes from './routes/characters';
import dictionaryRoutes from './routes/dictionary';
import uploadRoutes from './routes/upload';
import logRoutes from './routes/logs';

const app = express();
const httpServer = createServer(app);

// ── 미들웨어 ──────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:3000', process.env.FRONTEND_URL || ''].filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ── API 라우트 ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/dictionary', dictionaryRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/logs', logRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 전역 에러 핸들러 (반드시 라우트 등록 뒤, 4개 인자 형태여야 Express가 인식) ──
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);

  console.error('[Error]', err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err instanceof MongooseError.CastError) {
    return res.status(400).json({ error: '잘못된 ID 형식입니다.' });
  }
  if (err instanceof MongooseError.ValidationError) {
    return res.status(400).json({ error: err.message });
  }
  return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

// ── Socket.IO 초기화 ──────────────────────────────────────────
initSocketIO(httpServer);

// ── MongoDB 연결 ──────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '4000');
const MONGODB_URI = process.env.MONGODB_URI!;

async function bootstrap() {
  if (!MONGODB_URI) {
    console.warn('[DB] MONGODB_URI not set. Running without database.');
  } else {
    await mongoose.connect(MONGODB_URI);
    console.log('[DB] MongoDB connected');
  }

  httpServer.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
}

bootstrap().catch(console.error);
