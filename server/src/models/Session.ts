import mongoose, { Schema, Document } from 'mongoose';

export type SessionParticipant = {
  discordId: string;
  userName: string;
  avatarUrl: string;
  characterId?: mongoose.Types.ObjectId;
  role: 'master' | 'player';
  joinedAt: Date;
};

export interface ISession extends Document {
  sessionId: string;
  name: string;
  guildId: string;
  masterId: string;
  participants: SessionParticipant[];
  maxParticipants: number;   // 최대 10명
  status: 'waiting' | 'active' | 'ended';
  backgroundPreset?: string;
  bgmPreset?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ParticipantSchema = new Schema<SessionParticipant>({
  discordId: { type: String, required: true },
  userName: { type: String, required: true },
  avatarUrl: { type: String, default: '' },
  characterId: { type: Schema.Types.ObjectId, ref: 'Character' },
  role: { type: String, enum: ['master', 'player'], required: true },
  joinedAt: { type: Date, default: Date.now },
});

const SessionSchema = new Schema<ISession>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    guildId: { type: String, required: true, index: true },
    masterId: { type: String, required: true },
    participants: [ParticipantSchema],
    maxParticipants: { type: Number, default: 10, min: 2, max: 10 },
    status: {
      type: String,
      enum: ['waiting', 'active', 'ended'],
      default: 'waiting',
    },
    backgroundPreset: { type: String },
    bgmPreset: { type: String },
  },
  { timestamps: true }
);

export const Session = mongoose.model<ISession>('Session', SessionSchema);
