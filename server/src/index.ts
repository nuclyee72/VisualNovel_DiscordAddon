import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { initSocketIO } from './socket';

// Routes
import authRoutes from './routes/auth';
import sessionRoutes from './routes/sessions';
import characterRoutes from './routes/characters';
import dictionaryRoutes from './routes/dictionary';
import uploadRoutes from './routes/upload';
import logRoutes from './routes/logs';

dotenv.config({ path: '../../.env' });

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
