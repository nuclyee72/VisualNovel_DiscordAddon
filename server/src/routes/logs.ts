import { Router, Response } from 'express';
import { SessionLog } from '../models/SessionLog';
import { authMiddleware, AuthRequest, isGuildMember } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authMiddleware);

// 세션 로그 조회
router.get('/:sessionId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const log = await SessionLog.findOne({ sessionId: req.params.sessionId }).lean();
  if (!log) return res.status(404).json({ error: '로그를 찾을 수 없습니다.' });
  if (!(await isGuildMember(req.user!.discordId, log.guildId))) {
    return res.status(403).json({ error: '이 서버의 멤버만 조회할 수 있습니다.' });
  }
  return res.json(log);
}));

// TXT 다운로드
router.get('/:sessionId/download/txt', asyncHandler(async (req: AuthRequest, res: Response) => {
  const log = await SessionLog.findOne({ sessionId: req.params.sessionId }).lean();
  if (!log) return res.status(404).json({ error: '로그를 찾을 수 없습니다.' });
  if (!(await isGuildMember(req.user!.discordId, log.guildId))) {
    return res.status(403).json({ error: '이 서버의 멤버만 다운로드할 수 있습니다.' });
  }

  const lines: string[] = [
    '===== TRPG 세션 로그 =====',
    `세션명: ${log.sessionName}`,
    `날짜: ${log.startedAt.toLocaleDateString('ko-KR')}`,
    `참여자: ${log.participants.join(', ')}`,
    `마스터: ${log.masterId}`,
    '=========================',
    '',
  ];

  const startMs = log.startedAt.getTime();

  for (const entry of log.entries) {
    const elapsed = entry.timestamp - startMs;
    const mm = Math.floor(elapsed / 60000).toString().padStart(2, '0');
    const ss = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0');
    const time = `[${mm}:${ss}]`;

    switch (entry.type) {
      case 'dialogue':
        lines.push(`${time} ${entry.speaker ?? '???'}: ${entry.content}`);
        break;
      case 'dice':
        lines.push(`${time} 🎲 ${entry.content}`);
        break;
      case 'bgm':
        lines.push(`${time} 🎵 ${entry.content}`);
        break;
      case 'background':
        lines.push(`${time} 🖼️  ${entry.content}`);
        break;
      case 'status':
        lines.push(`${time} 📊 ${entry.content}`);
        break;
      case 'system':
        lines.push(`${time} ⚙️  ${entry.content}`);
        break;
      case 'expression':
        lines.push(`${time} 🙂 ${entry.content}`);
        break;
    }
  }

  if (log.endedAt) {
    lines.push('');
    lines.push(`===== 세션 종료: ${log.endedAt.toLocaleTimeString('ko-KR')} =====`);
  }

  const content = lines.join('\n');
  const filename = `${log.sessionName}_log.txt`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  return res.send(Buffer.from(content, 'utf-8'));
}));

// JSON 다운로드
router.get('/:sessionId/download/json', asyncHandler(async (req: AuthRequest, res: Response) => {
  const log = await SessionLog.findOne({ sessionId: req.params.sessionId }).lean();
  if (!log) return res.status(404).json({ error: '로그를 찾을 수 없습니다.' });
  if (!(await isGuildMember(req.user!.discordId, log.guildId))) {
    return res.status(403).json({ error: '이 서버의 멤버만 다운로드할 수 있습니다.' });
  }

  const filename = `${log.sessionName}_log.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  return res.json({
    sessionId: log.sessionId,
    sessionName: log.sessionName,
    guildId: log.guildId,
    startedAt: log.startedAt,
    endedAt: log.endedAt,
    participants: log.participants,
    entries: log.entries.map((e) => ({
      t: e.timestamp - log.startedAt.getTime(),
      type: e.type,
      speaker: e.speaker,
      content: e.content,
      metadata: e.metadata,
    })),
  });
}));

export default router;
