import { Router, Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

const router = Router();

const DISCORD_API = 'https://discord.com/api/v10';

// OAuth2 로그인 URL 리다이렉트
router.get('/login', (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    redirect_uri: process.env.DISCORD_REDIRECT_URI!,
    response_type: 'code',
    scope: 'identify guilds',
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

// OAuth2 콜백
router.get('/callback', async (req: Request, res: Response) => {
  const { code } = req.query as { code?: string };
  if (!code) {
    return res.redirect('/login?error=no_code');
  }

  try {
    // code → access_token 교환
    const tokenRes = await axios.post(
      `${DISCORD_API}/oauth2/token`,
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID!,
        client_secret: process.env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI!,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token } = tokenRes.data as { access_token: string };

    // 유저 정보 조회
    const [userRes, guildsRes] = await Promise.all([
      axios.get(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${access_token}` },
      }),
      axios.get(`${DISCORD_API}/users/@me/guilds`, {
        headers: { Authorization: `Bearer ${access_token}` },
      }),
    ]);

    const discordUser = userRes.data as {
      id: string;
      username: string;
      discriminator: string;
      avatar?: string;
    };
    const guildIds = (guildsRes.data as Array<{ id: string }>).map((g) => g.id);

    // DB upsert
    const user = await User.findOneAndUpdate(
      { discordId: discordUser.id },
      {
        discordId: discordUser.id,
        username: discordUser.username,
        discriminator: discordUser.discriminator || '0',
        avatar: discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
          : `https://cdn.discordapp.com/embed/avatars/0.png`,
        guilds: guildIds,
      },
      { upsert: true, new: true }
    );

    // JWT 발급
    const token = jwt.sign(
      { discordId: user.discordId, userName: user.username },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    // HttpOnly 쿠키 설정
    res.cookie('vn_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    });

    // 프론트엔드 대시보드로 리다이렉트
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard`);
  } catch (err) {
    console.error('[Auth] OAuth callback error:', err);
    res.redirect('/login?error=oauth_failed');
  }
});

// 현재 유저 정보
router.get('/me', async (req: Request, res: Response) => {
  const token = req.cookies?.vn_token as string | undefined;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      discordId: string;
      userName: string;
    };
    const user = await User.findOne({ discordId: payload.discordId })
      .populate('characters')
      .lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// 로그아웃
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('vn_token');
  res.json({ success: true });
});

export default router;
