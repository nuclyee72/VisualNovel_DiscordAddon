import { Router, Response } from 'express';
import { Character } from '../models/Character';
import { User } from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authMiddleware);

// 내 캐릭터 목록
router.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const characters = await Character.find({ ownerId: req.user!.discordId }).lean();
  return res.json(characters);
}));

// 캐릭터 생성
router.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, description, job, stats } = req.body as {
    name: string;
    description?: string;
    job?: string;
    stats?: { hp: { max: number }; mp: { max: number } };
  };

  const character = await Character.create({
    ownerId: req.user!.discordId,
    name,
    description,
    job,
    images: [],
    stats: {
      hp: { current: stats?.hp?.max ?? 100, max: stats?.hp?.max ?? 100 },
      mp: { current: stats?.mp?.max ?? 50, max: stats?.mp?.max ?? 50 },
      custom: [],
    },
  });

  // 유저에 캐릭터 레퍼런스 추가
  await User.updateOne(
    { discordId: req.user!.discordId },
    { $push: { characters: character._id } }
  );

  return res.status(201).json(character);
}));

// 캐릭터 수정
router.put('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const character = await Character.findOne({
    _id: req.params.id,
    ownerId: req.user!.discordId,
  });
  if (!character) return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다.' });

  const { name, description, job, stats, baseImageUrl, anchorX, anchorY } = req.body as {
    name?: string;
    description?: string;
    job?: string;
    stats?: { hp?: { current?: number; max?: number }; mp?: { current?: number; max?: number } };
    baseImageUrl?: string;
    anchorX?: number;
    anchorY?: number;
  };

  if (name) character.name = name;
  if (description !== undefined) character.description = description;
  if (job !== undefined) character.job = job;
  if (baseImageUrl !== undefined) character.baseImageUrl = baseImageUrl;
  if (anchorX !== undefined) character.anchorX = anchorX;
  if (anchorY !== undefined) character.anchorY = anchorY;
  if (stats?.hp?.max !== undefined) character.stats.hp.max = Math.max(1, stats.hp.max);
  if (stats?.hp?.current !== undefined) {
    character.stats.hp.current = Math.max(0, Math.min(stats.hp.current, character.stats.hp.max));
  }
  if (stats?.mp?.max !== undefined) character.stats.mp.max = Math.max(1, stats.mp.max);
  if (stats?.mp?.current !== undefined) {
    character.stats.mp.current = Math.max(0, Math.min(stats.mp.current, character.stats.mp.max));
  }

  await character.save();
  return res.json(character);
}));

// 이미지 태그 추가 (업로드 후 URL로 등록)
router.post('/:id/images', asyncHandler(async (req: AuthRequest, res: Response) => {
  const character = await Character.findOne({
    _id: req.params.id,
    ownerId: req.user!.discordId,
  });
  if (!character) return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다.' });

  const { tag, url, key } = req.body as { tag?: string; url?: string; key?: string };
  if (!tag || !url || !key) {
    return res.status(400).json({ error: 'tag, url, key가 모두 필요합니다.' });
  }

  // 기존 같은 태그 교체
  const existingIdx = character.images.findIndex((img) => img.tag === tag);
  if (existingIdx >= 0) {
    character.images[existingIdx] = { tag, url, key };
  } else {
    character.images.push({ tag, url, key });
  }

  await character.save();
  return res.json(character);
}));

// 이미지 태그 삭제
router.delete('/:id/images/:tag', asyncHandler(async (req: AuthRequest, res: Response) => {
  const character = await Character.findOne({
    _id: req.params.id,
    ownerId: req.user!.discordId,
  });
  if (!character) return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다.' });

  character.images = character.images.filter((img) => img.tag !== req.params.tag);
  await character.save();
  return res.json(character);
}));

// 캐릭터 삭제
router.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const character = await Character.findOneAndDelete({
    _id: req.params.id,
    ownerId: req.user!.discordId,
  });
  if (!character) return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다.' });

  await User.updateOne(
    { discordId: req.user!.discordId },
    { $pull: { characters: character._id } }
  );
  return res.json({ success: true });
}));

export default router;
