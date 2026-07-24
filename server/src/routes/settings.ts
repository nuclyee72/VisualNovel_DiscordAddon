import { Router, Response } from 'express';
import { User } from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authMiddleware);

const ALLOWED_TYPING_SPEEDS = [1.0, 1.5, 2.0];

// 뷰어 기본 설정 (기본 오토모드 / 기본 배속) 저장
router.patch('/viewer', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { defaultAutoMode, defaultTypingSpeed } = req.body as {
    defaultAutoMode?: unknown;
    defaultTypingSpeed?: unknown;
  };

  const update: Record<string, unknown> = {};

  if (defaultAutoMode !== undefined) {
    if (typeof defaultAutoMode !== 'boolean') {
      return res.status(400).json({ error: 'defaultAutoMode는 boolean이어야 합니다.' });
    }
    update['viewerSettings.defaultAutoMode'] = defaultAutoMode;
  }

  if (defaultTypingSpeed !== undefined) {
    if (typeof defaultTypingSpeed !== 'number' || !ALLOWED_TYPING_SPEEDS.includes(defaultTypingSpeed)) {
      return res.status(400).json({ error: `defaultTypingSpeed는 ${ALLOWED_TYPING_SPEEDS.join(', ')} 중 하나여야 합니다.` });
    }
    update['viewerSettings.defaultTypingSpeed'] = defaultTypingSpeed;
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: '변경할 항목이 없습니다.' });
  }

  await User.updateOne({ discordId: req.user!.discordId }, { $set: update });
  return res.json({ success: true });
}));

// 표정 자동 감지 기능 on/off
router.patch('/expression', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { enabled } = req.body as { enabled?: unknown };
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled는 boolean이어야 합니다.' });
  }

  await User.updateOne({ discordId: req.user!.discordId }, { $set: { expressionAutoDetect: enabled } });
  return res.json({ success: true });
}));

export default router;
