import mongoose, { Schema, Document } from 'mongoose';

export interface ICharacterImage {
  tag: string;    // e.g. '#기본', '#웃음'
  url: string;    // Cloudflare R2 URL
  key: string;    // R2 object key
}

export interface ICharacter extends Document {
  ownerId: string;        // Discord User ID
  name: string;
  description?: string;
  job?: string;
  images: ICharacterImage[];
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
