import { Router, Response } from 'express';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// 표정 템플릿 자동 생성 기능은 아바타 이미지를 <canvas>에 그린 뒤 잘라내는데, R2
// 공개 URL은 CORS 헤더 없이 응답하므로 canvas가 오염(tainted)되어 내보내기가
// 막힌다. 우리 서버를 거쳐 CORS 헤더를 붙여 응답하면 브라우저가 canvas 내보내기를
// 허용한다. R2 공개 URL 자체가 인증 없이 누구나 열람 가능한 리소스이므로 이 라우트도
// 인증을 요구하지 않는다 (그래서 아래 authMiddleware 등록보다 앞에 둔다).
router.get('/proxy-image', async (req, res) => {
  const url = typeof req.query.url === 'string' ? req.query.url : '';
  const allowedPrefix = process.env.R2_PUBLIC_URL;

  if (!allowedPrefix || !url.startsWith(allowedPrefix)) {
    return res.status(400).json({ error: '허용되지 않은 이미지 URL입니다.' });
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: '이미지를 불러올 수 없습니다.' });
    }
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('Content-Type', contentType);
    return res.send(buffer);
  } catch (err) {
    console.error('[Upload] 이미지 프록시 실패:', err);
    return res.status(502).json({ error: '이미지를 불러오는 중 오류가 발생했습니다.' });
  }
});

router.use(authMiddleware);

// Cloudflare R2 클라이언트 설정
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// 메모리 스토리지 (버퍼 직접 업로드)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('허용되지 않는 파일 형식입니다. (jpg, png, gif, webp만 가능)'));
    }
  },
});

// 이미지 업로드 → Cloudflare R2
router.post('/image', upload.single('image'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const key = `characters/${req.user!.discordId}/${uuidv4()}${ext}`;

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    return res.json({ url: publicUrl, key });
  } catch (err) {
    console.error('[Upload] R2 이미지 업로드 실패:', err);
    return res.status(500).json({ error: '이미지 업로드에 실패했습니다. (R2 저장소 설정을 확인해주세요)' });
  }
});

// BGM 파일 업로드
router.post('/audio', upload.single('audio'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });

  const allowed = ['audio/mpeg', 'audio/ogg', 'audio/wav'];
  if (!allowed.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'mp3, ogg, wav 파일만 업로드 가능합니다.' });
  }

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const key = `bgm/${req.user!.discordId}/${uuidv4()}${ext}`;

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    return res.json({ url: publicUrl, key });
  } catch (err) {
    console.error('[Upload] R2 오디오 업로드 실패:', err);
    return res.status(500).json({ error: '오디오 업로드에 실패했습니다. (R2 저장소 설정을 확인해주세요)' });
  }
});

export default router;
