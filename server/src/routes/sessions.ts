import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Session } from '../models/Session';
import { SessionLog } from '../models/SessionLog';
import { User } from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// 세션 생성 (마스터용)
router.post('/', async (req: AuthRequest, res: Response) => {
  const { name, guildId } = req.body as { name: string; guildId: string };

  // 길드 소속 검증
  const user = await User.findOne({ discordId: req.user!.discordId });
  if (!user || !user.guilds.includes(guildId)) {
    return res.status(403).json({ error: '해당 서버의 멤버만 세션을 생성할 수 있습니다.' });
  }

  const sessionId = uuidv4();

  const session = await Session.create({
    sessionId,
    name,
    guildId,
    masterId: req.user!.discordId,
    participants: [
      {
        discordId: req.user!.discordId,
        userName: req.user!.userName,
        avatarUrl: user.avatar || '',
        role: 'master',
        joinedAt: new Date(),
      },
    ],
    status: 'waiting',
  });

  // 세션 로그 초기화
  await SessionLog.create({
    sessionId,
    sessionName: name,
    guildId,
    masterId: req.user!.discordId,
    startedAt: new Date(),
    participants: [req.user!.userName],
    entries: [],
  });

  return res.status(201).json({ session, joinUrl: `/session/${sessionId}` });
});

// 세션 목록 조회
router.get('/', async (req: AuthRequest, res: Response) => {
  const { guildId } = req.query as { guildId?: string };
  const query = guildId ? { guildId } : {};
  const sessions = await Session.find(query).sort({ createdAt: -1 }).limit(20);
  return res.json(sessions);
});

// 단일 세션 조회
router.get('/:sessionId', async (req: AuthRequest, res: Response) => {
  const session = await Session.findOne({ sessionId: req.params.sessionId });
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
  return res.json(session);
});

// 세션 입장 (참여자 추가)
router.post('/:sessionId/join', async (req: AuthRequest, res: Response) => {
  const session = await Session.findOne({ sessionId: req.params.sessionId });
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
  if (session.status === 'ended') return res.status(400).json({ error: '종료된 세션입니다.' });

  // 최대 인원 체크 (기본 10명)
  const maxAllowed = session.maxParticipants ?? 10;
  if (session.participants.length >= maxAllowed) {
    return res.status(409).json({ error: `세션 정원이 초과되었습니다. (최대 ${maxAllowed}명)` });
  }

  const user = await User.findOne({ discordId: req.user!.discordId });
  if (!user) return res.status(404).json({ error: '유저 정보를 찾을 수 없습니다.' });

  // 이미 참여 중인지 확인
  const alreadyIn = session.participants.some((p) => p.discordId === req.user!.discordId);
  if (!alreadyIn) {
    session.participants.push({
      discordId: req.user!.discordId,
      userName: req.user!.userName,
      avatarUrl: user.avatar || '',
      role: 'player',
      joinedAt: new Date(),
    });
    await session.save();

    // 로그에 참여자 추가
    await SessionLog.updateOne(
      { sessionId: req.params.sessionId },
      { $addToSet: { participants: req.user!.userName } }
    );
  }

  return res.json({ session });
});

// 세션 시작
router.patch('/:sessionId/start', async (req: AuthRequest, res: Response) => {
  const session = await Session.findOne({ sessionId: req.params.sessionId });
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
  if (session.masterId !== req.user!.discordId) {
    return res.status(403).json({ error: '마스터만 세션을 시작할 수 있습니다.' });
  }
  session.status = 'active';
  await session.save();
  return res.json({ success: true });
});

// 세션 종료
router.delete('/:sessionId', async (req: AuthRequest, res: Response) => {
  const session = await Session.findOne({ sessionId: req.params.sessionId });
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
  if (session.masterId !== req.user!.discordId) {
    return res.status(403).json({ error: '마스터만 세션을 종료할 수 있습니다.' });
  }
  session.status = 'ended';
  await session.save();

  // 로그 종료 시간 기록
  await SessionLog.updateOne(
    { sessionId: req.params.sessionId },
    { endedAt: new Date() }
  );

  return res.json({ success: true });
});

export default router;
