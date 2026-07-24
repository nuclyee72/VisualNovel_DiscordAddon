import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Session } from '../models/Session';
import { SessionLog } from '../models/SessionLog';
import { Character } from '../models/Character';
import { User } from '../models/User';
import { authMiddleware, AuthRequest, isGuildMember } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authMiddleware);

// 세션 생성 (마스터용)
router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, guildId, masterUserName, masterAvatarUrl } = req.body as {
    name?: string;
    guildId?: string;
    masterUserName?: string;
    masterAvatarUrl?: string;
  };
  if (!name || typeof name !== 'string' || !guildId || typeof guildId !== 'string') {
    return res.status(400).json({ error: 'name과 guildId가 필요합니다.' });
  }

  let user = await User.findOne({ discordId: req.user!.discordId });

  if (!user) {
    // 봇 명령어를 통한 생성은 이미 그 길드 안에서 실행된 인터랙션이 길드 소속의 증거이므로,
    // 웹 로그인 이력이 없어도(User 문서가 아직 없어도) 새로 만들어 진행을 허용한다.
    if (!req.isBotConnection) {
      return res.status(403).json({ error: '해당 서버의 멤버만 세션을 생성할 수 있습니다.' });
    }
    user = await User.create({
      discordId: req.user!.discordId,
      username: masterUserName || req.user!.userName,
      avatar: masterAvatarUrl,
      guilds: [guildId],
    });
  } else if (!user.guilds.includes(guildId)) {
    if (!req.isBotConnection) {
      return res.status(403).json({ error: '해당 서버의 멤버만 세션을 생성할 수 있습니다.' });
    }
    user.guilds.push(guildId);
    await user.save();
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
        userName: user.username,
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
    participants: [user.username],
    entries: [],
  });

  return res.status(201).json({ session, joinUrl: `/session/${sessionId}` });
}));

// 세션 목록 조회. guildId를 지정하면 해당 길드(소속 확인) 세션만,
// 지정하지 않으면 내가 속한 모든 길드의 세션을 보여준다 (전체 길드 열람은 항상 차단).
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { guildId } = req.query;
  const user = await User.findOne({ discordId: req.user!.discordId });
  if (!user) return res.status(404).json({ error: '유저 정보를 찾을 수 없습니다.' });

  if (guildId !== undefined) {
    if (typeof guildId !== 'string' || !user.guilds.includes(guildId)) {
      return res.status(403).json({ error: '이 서버의 멤버만 세션 목록을 조회할 수 있습니다.' });
    }
    const sessions = await Session.find({ guildId }).sort({ createdAt: -1 }).limit(20);
    return res.json(sessions);
  }

  const sessions = await Session.find({ guildId: { $in: user.guilds } })
    .sort({ createdAt: -1 })
    .limit(20);
  return res.json(sessions);
}));

// 단일 세션 조회
router.get('/:sessionId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const session = await Session.findOne({ sessionId: req.params.sessionId });
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });

  if (!(await isGuildMember(req.user!.discordId, session.guildId))) {
    return res.status(403).json({ error: '이 서버의 멤버만 조회할 수 있습니다.' });
  }

  return res.json(session);
}));

// 참가자 현재 스탯 조회 (봇의 /hp, /mp 명령어가 사용)
router.get('/:sessionId/participant/:discordId/stats', asyncHandler(async (req: AuthRequest, res: Response) => {
  const session = await Session.findOne({ sessionId: req.params.sessionId });
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });

  const isParticipant = session.participants.some((p) => p.discordId === req.params.discordId);
  if (!isParticipant) {
    return res.status(404).json({ error: '해당 유저는 이 세션의 참가자가 아닙니다.' });
  }

  const character = await Character.findOne({ ownerId: req.params.discordId });
  if (!character) {
    return res.status(404).json({ error: '등록된 캐릭터가 없습니다.' });
  }

  return res.json({ hp: character.stats.hp, mp: character.stats.mp });
}));

// 세션 입장 (참여자 추가)
router.post('/:sessionId/join', asyncHandler(async (req: AuthRequest, res: Response) => {
  const session = await Session.findOne({ sessionId: req.params.sessionId });
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
  if (session.status === 'ended') return res.status(400).json({ error: '종료된 세션입니다.' });

  if (!(await isGuildMember(req.user!.discordId, session.guildId))) {
    return res.status(403).json({ error: '이 서버의 멤버만 참가할 수 있습니다.' });
  }

  // 최대 인원 체크 (기본 10명)
  const maxAllowed = session.maxParticipants ?? 10;

  const user = await User.findOne({ discordId: req.user!.discordId });
  if (!user) return res.status(404).json({ error: '유저 정보를 찾을 수 없습니다.' });

  // 이미 참여 중인지 확인
  const alreadyIn = session.participants.some((p) => p.discordId === req.user!.discordId);
  if (!alreadyIn) {
    if (session.participants.length >= maxAllowed) {
      return res.status(409).json({ error: `세션 정원이 초과되었습니다. (최대 ${maxAllowed}명)` });
    }

    session.participants.push({
      discordId: req.user!.discordId,
      userName: req.user!.userName,
      avatarUrl: user.avatar || '',
      role: 'player',
      joinedAt: new Date(),
    });

    try {
      await session.save();
    } catch (err) {
      // 동시 입장 경합으로 인한 VersionError — 최신 상태로 한 번만 재시도
      const fresh = await Session.findOne({ sessionId: req.params.sessionId });
      if (!fresh) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
      if (fresh.participants.length >= maxAllowed) {
        return res.status(409).json({ error: `세션 정원이 초과되었습니다. (최대 ${maxAllowed}명)` });
      }
      if (!fresh.participants.some((p) => p.discordId === req.user!.discordId)) {
        fresh.participants.push({
          discordId: req.user!.discordId,
          userName: req.user!.userName,
          avatarUrl: user.avatar || '',
          role: 'player',
          joinedAt: new Date(),
        });
        await fresh.save();
      }
    }

    // 로그에 참여자 추가
    await SessionLog.updateOne(
      { sessionId: req.params.sessionId },
      { $addToSet: { participants: req.user!.userName } }
    );
  }

  return res.json({ session });
}));

// 세션 시작
router.patch('/:sessionId/start', asyncHandler(async (req: AuthRequest, res: Response) => {
  const session = await Session.findOne({ sessionId: req.params.sessionId });
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
  if (session.masterId !== req.user!.discordId) {
    return res.status(403).json({ error: '마스터만 세션을 시작할 수 있습니다.' });
  }
  session.status = 'active';
  await session.save();
  return res.json({ success: true });
}));

// 세션 종료
router.delete('/:sessionId', asyncHandler(async (req: AuthRequest, res: Response) => {
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
}));

// 세션 완전 삭제 (되돌릴 수 없음 — 대화 로그까지 함께 지워진다).
// 이미 종료된 세션만 삭제 가능 (진행 중인 세션은 먼저 닫아야 함), 마스터만 가능.
router.delete('/:sessionId/permanent', asyncHandler(async (req: AuthRequest, res: Response) => {
  const session = await Session.findOne({ sessionId: req.params.sessionId });
  if (!session) return res.status(404).json({ error: '세션을 찾을 수 없습니다.' });
  if (session.masterId !== req.user!.discordId) {
    return res.status(403).json({ error: '마스터만 세션을 삭제할 수 있습니다.' });
  }
  if (session.status !== 'ended') {
    return res.status(400).json({ error: '종료된 세션만 삭제할 수 있습니다. 먼저 세션을 닫아주세요.' });
  }

  await Session.deleteOne({ sessionId: req.params.sessionId });
  await SessionLog.deleteOne({ sessionId: req.params.sessionId });

  return res.json({ success: true });
}));

export default router;
