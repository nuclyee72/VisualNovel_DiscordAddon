import { Router, Response } from 'express';
import { DictionaryEntry } from '../models/DictionaryEntry';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// 사전 조회 (guildId 필수)
router.get('/', async (req: AuthRequest, res: Response) => {
  const { guildId, search } = req.query as { guildId?: string; search?: string };
  if (!guildId) return res.status(400).json({ error: 'guildId가 필요합니다.' });

  const query: Record<string, unknown> = { guildId };
  if (search) {
    query.word = { $regex: search, $options: 'i' };
  }

  const entries = await DictionaryEntry.find(query).sort({ word: 1 }).lean();
  return res.json(entries);
});

// 단어 등록
router.post('/', async (req: AuthRequest, res: Response) => {
  const { guildId, word, description, category } = req.body as {
    guildId: string;
    word: string;
    description: string;
    category?: string;
  };

  try {
    const entry = await DictionaryEntry.create({
      guildId,
      word,
      description,
      category,
      addedBy: req.user!.discordId,
    });
    return res.status(201).json(entry);
  } catch (err: unknown) {
    const error = err as { code?: number };
    if (error.code === 11000) {
      return res.status(409).json({ error: '이미 등록된 단어입니다.' });
    }
    throw err;
  }
});

// 단어 수정
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const { description, category } = req.body as { description?: string; category?: string };
  const entry = await DictionaryEntry.findByIdAndUpdate(
    req.params.id,
    { description, category },
    { new: true }
  );
  if (!entry) return res.status(404).json({ error: '단어를 찾을 수 없습니다.' });
  return res.json(entry);
});

// 단어 삭제
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  await DictionaryEntry.findByIdAndDelete(req.params.id);
  return res.json({ success: true });
});

export default router;
