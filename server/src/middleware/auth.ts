import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

export interface AuthRequest extends Request {
  user?: {
    discordId: string;
    userName: string;
  };
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.vn_token as string | undefined;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      discordId: string;
      userName: string;
    };
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// 길드 소속 검증 미들웨어
export async function guildGuard(guildId: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const user = await User.findOne({ discordId: req.user.discordId });
    if (!user || !user.guilds.includes(guildId)) {
      return res.status(403).json({ error: '이 서버의 멤버만 접근할 수 있습니다.' });
    }
    return next();
  };
}
