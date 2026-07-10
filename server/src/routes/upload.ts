import { Router, Response } from 'express';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
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
});

// BGM 파일 업로드
router.post('/audio', upload.single('audio'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });

  const allowed = ['audio/mpeg', 'audio/ogg', 'audio/wav'];
  if (!allowed.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'mp3, ogg, wav 파일만 업로드 가능합니다.' });
  }

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
});

export default router;
