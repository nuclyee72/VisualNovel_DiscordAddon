import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

export interface AuthRequest extends Request {
  user?: {
    discordId: string;
    userName: string;
  };
  // 디스코드 봇이 x-bot-secret으로 인증한 요청인지 여부. 봇 명령어는 이미 디스코드
  // 길드 안에서 실행된 인터랙션이므로, 별도의 길드 소속 확인 없이도 신뢰할 수 있다.
  isBotConnection?: boolean;
}

const DISCORD_SNOWFLAKE = /^\d{17,20}$/;

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  // 봇(마스터) → 서버 내부 호출: BOT_SECRET + 대상 디스코드 유저 ID로 인증
  const botSecret = req.headers['x-bot-secret'] as string | undefined;
  if (botSecret && botSecret === process.env.BOT_SECRET) {
    const discordId = req.headers['x-discord-user-id'] as string | undefined;
    if (!discordId || !DISCORD_SNOWFLAKE.test(discordId)) {
      return res.status(400).json({ error: 'x-discord-user-id 헤더가 유효하지 않습니다.' });
    }
    req.user = { discordId, userName: 'Bot' };
    req.isBotConnection = true;
    return next();
  }

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

// 길드 소속 검증 헬퍼. 대상 리소스의 guildId는 라우트마다 DB 조회 후에야 알 수 있는
// 경우가 많아(사전 항목, 세션 로그 등) 정적 미들웨어보다 라우트 내부에서 직접 호출한다.
export async function isGuildMember(discordId: string, guildId: string): Promise<boolean> {
  const user = await User.findOne({ discordId });
  return !!user?.guilds.includes(guildId);
}
