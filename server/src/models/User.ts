import mongoose, { Schema, Document } from 'mongoose';

export interface IViewerSettings {
  defaultAutoMode: boolean;
  defaultTypingSpeed: number; // 1.0, 1.5, 2.0
}

export interface IUser extends Document {
  discordId: string;
  username: string;
  discriminator: string;
  avatar?: string;
  guilds: string[];          // Guild ID 배열
  characters: mongoose.Types.ObjectId[];
  activeCharacterId?: mongoose.Types.ObjectId; // 세션 참가 시 사용할 "선택된" 캐릭터
  viewerSettings: IViewerSettings;
  // 대사 텍스트 문맥을 8가지 감정으로 분류해 표정을 자동으로 바꿔주는 기능의 on/off.
  // 이모지/수동 명령어로 이미 표정이 지정된 경우에는 이 설정과 무관하게 그 지정이 우선한다.
  expressionAutoDetect: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ViewerSettingsSchema = new Schema<IViewerSettings>(
  {
    defaultAutoMode: { type: Boolean, default: false },
    defaultTypingSpeed: { type: Number, default: 1.0, min: 0.5, max: 3.0 },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    discordId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    discriminator: { type: String, default: '0' },
    avatar: { type: String },
    guilds: [{ type: String }],
    characters: [{ type: Schema.Types.ObjectId, ref: 'Character' }],
    activeCharacterId: { type: Schema.Types.ObjectId, ref: 'Character' },
    viewerSettings: {
      type: ViewerSettingsSchema,
      default: () => ({ defaultAutoMode: false, defaultTypingSpeed: 1.0 }),
    },
    expressionAutoDetect: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
