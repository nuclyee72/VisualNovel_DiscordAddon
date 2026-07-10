import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  discordId: string;
  username: string;
  discriminator: string;
  avatar?: string;
  guilds: string[];          // Guild ID 배열
  characters: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    discordId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    discriminator: { type: String, default: '0' },
    avatar: { type: String },
    guilds: [{ type: String }],
    characters: [{ type: Schema.Types.ObjectId, ref: 'Character' }],
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
