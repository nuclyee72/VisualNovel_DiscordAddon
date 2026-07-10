import mongoose, { Schema, Document } from 'mongoose';

export interface ICharacterImage {
  tag: string;    // e.g. '#Neutral', '#Happy'
  url: string;    // Cloudflare R2 URL
  key: string;    // R2 object key
}

export interface ICharacter extends Document {
  ownerId: string;        // Discord User ID
  name: string;
  description?: string;
  job?: string;
  images: ICharacterImage[];
  baseImageUrl?: string;    // (NEW) 몸통 이미지 URL
  anchorX?: number;         // (NEW) 얼굴 앵커 X% (0~100)
  anchorY?: number;         // (NEW) 얼굴 앵커 Y% (0~100)
  stats: {
    hp: { current: number; max: number };
    mp: { current: number; max: number };
    custom: Array<{ name: string; current: number; max: number }>;
  };
  createdAt: Date;
  updatedAt: Date;
}

const CharacterImageSchema = new Schema<ICharacterImage>({
  tag: { type: String, required: true },
  url: { type: String, required: true },
  key: { type: String, required: true },
});

const CharacterSchema = new Schema<ICharacter>(
  {
    ownerId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    job: { type: String },
    images: [CharacterImageSchema],
    baseImageUrl: { type: String },
    anchorX: { type: Number, default: 50 },
    anchorY: { type: Number, default: 10 },
    stats: {
      hp: {
        current: { type: Number, default: 100 },
        max: { type: Number, default: 100 },
      },
      mp: {
        current: { type: Number, default: 50 },
        max: { type: Number, default: 50 },
      },
      custom: [
        {
          name: String,
          current: Number,
          max: Number,
        },
      ],
    },
  },
  { timestamps: true }
);

export const Character = mongoose.model<ICharacter>('Character', CharacterSchema);
