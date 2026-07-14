import { Router, Response } from 'express';
import { DictionaryEntry } from '../models/DictionaryEntry';
import { authMiddleware, AuthRequest, isGuildMember } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authMiddleware);

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 사전 조회 (guildId 필수)
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { guildId, search } = req.query as { guildId?: string; search?: string };
  if (!guildId || typeof guildId !== 'string') {
    return res.status(400).json({ error: 'guildId가 필요합니다.' });
  }
  if (!(await isGuildMember(req.user!.discordId, guildId))) {
    return res.status(403).json({ error: '이 서버의 멤버만 조회할 수 있습니다.' });
  }

  const query: Record<string, unknown> = { guildId };
  if (search && typeof search === 'string') {
    query.word = { $regex: escapeRegex(search), $options: 'i' };
  }

  const entries = await DictionaryEntry.find(query).sort({ word: 1 }).lean();
  return res.json(entries);
}));

// 단어 등록
router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { guildId, word, description, category } = req.body as {
    guildId?: string;
    word?: string;
    description?: string;
    category?: string;
  };
  if (!guildId || typeof guildId !== 'string' || !word || !description) {
    return res.status(400).json({ error: 'guildId, word, description이 필요합니다.' });
  }
  if (!(await isGuildMember(req.user!.discordId, guildId))) {
    return res.status(403).json({ error: '이 서버의 멤버만 단어를 등록할 수 있습니다.' });
  }

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
}));

// 단어 수정
router.put('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await DictionaryEntry.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: '단어를 찾을 수 없습니다.' });
  if (!(await isGuildMember(req.user!.discordId, existing.guildId))) {
    return res.status(403).json({ error: '이 서버의 멤버만 수정할 수 있습니다.' });
  }

  const { description, category } = req.body as { description?: string; category?: string };
  if (description !== undefined) existing.description = description;
  if (category !== undefined) existing.category = category;
  await existing.save();
  return res.json(existing);
}));

// 단어 삭제
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await DictionaryEntry.findById(req.params.id);
  if (!existing) return res.status(404).json({ error: '단어를 찾을 수 없습니다.' });
  if (!(await isGuildMember(req.user!.discordId, existing.guildId))) {
    return res.status(403).json({ error: '이 서버의 멤버만 삭제할 수 있습니다.' });
  }

  await existing.deleteOne();
  return res.json({ success: true });
}));

export default router;
