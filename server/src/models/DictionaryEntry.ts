import mongoose, { Schema, Document } from 'mongoose';

export interface IDictionaryEntry extends Document {
  guildId: string;
  word: string;
  description: string;
  category?: string;
  addedBy: string;  // Discord ID
  createdAt: Date;
  updatedAt: Date;
}

const DictionaryEntrySchema = new Schema<IDictionaryEntry>(
  {
    guildId: { type: String, required: true, index: true },
    word: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String },
    addedBy: { type: String, required: true },
  },
  { timestamps: true }
);

// 같은 길드 내 단어 중복 방지
DictionaryEntrySchema.index({ guildId: 1, word: 1 }, { unique: true });

export const DictionaryEntry = mongoose.model<IDictionaryEntry>(
  'DictionaryEntry',
  DictionaryEntrySchema
);
