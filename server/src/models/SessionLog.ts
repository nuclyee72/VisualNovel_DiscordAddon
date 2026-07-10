import mongoose, { Schema, Document } from 'mongoose';

export type LogEntryType =
  | 'dialogue'
  | 'dice'
  | 'bgm'
  | 'background'
  | 'status'
  | 'system'
  | 'expression';

export interface ILogEntry {
  timestamp: number;       // 세션 시작부터의 ms
  type: LogEntryType;
  speaker?: string;        // Discord username
  speakerId?: string;      // Discord ID
  content: string;         // 텍스트 표현
  metadata?: Record<string, unknown>;
}

export interface ISessionLog extends Document {
  sessionId: string;
  sessionName: string;
  guildId: string;
  masterId: string;
  startedAt: Date;
  endedAt?: Date;
  participants: string[];  // Discord usernames
  entries: ILogEntry[];
  createdAt: Date;
}

const LogEntrySchema = new Schema<ILogEntry>(
  {
    timestamp: { type: Number, required: true },
    type: {
      type: String,
      enum: ['dialogue', 'dice', 'bgm', 'background', 'status', 'system', 'expression'],
      required: true,
    },
    speaker: String,
    speakerId: String,
    content: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const SessionLogSchema = new Schema<ISessionLog>(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    sessionName: { type: String, required: true },
    guildId: { type: String, required: true },
    masterId: { type: String, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date },
    participants: [{ type: String }],
    entries: [LogEntrySchema],
  },
  { timestamps: true }
);

export const SessionLog = mongoose.model<ISessionLog>('SessionLog', SessionLogSchema);
