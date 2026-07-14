import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';

// 환경변수 로드
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

process.on('unhandledRejection', (err) => {
  console.error('[Bot][UnhandledRejection]', err);
});

// 슬래시 커맨드 타입
import type { SlashCommandType } from './types';

// 이벤트 핸들러 임포트
import { handleMessageCreate } from './events/messageCreate';
import { handleInteractionCreate } from './events/interactionCreate';
import { handleReady } from './events/ready';

// 커맨드 임포트
import backgroundCmd from './commands/background';
import bgmCmd from './commands/bgm';
import rollCmd from './commands/roll';
import hpCmd from './commands/hp';
import mpCmd from './commands/mp';
import sessionStartCmd from './commands/sessionStart';
import sessionEndCmd from './commands/sessionEnd';
import expressionCmd from './commands/expression';
import systemMsgCmd from './commands/systemMessage';
import dictionaryCmd from './commands/dictionary';

// ── Discord 클라이언트 ────────────────────────────────────────
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel],
});

// 커맨드 컬렉션
client.commands = new Collection<string, SlashCommandType>();

// 커맨드 등록
const commands: SlashCommandType[] = [
  backgroundCmd,
  bgmCmd,
  rollCmd,
  hpCmd,
  mpCmd,
  sessionStartCmd,
  sessionEndCmd,
  expressionCmd,
  systemMsgCmd,
  dictionaryCmd,
];
commands.forEach((cmd) => client.commands.set(cmd.data.name, cmd));

// ── Discord 이벤트 ────────────────────────────────────────────
client.once('ready', handleReady);
client.on('messageCreate', handleMessageCreate);
client.on('interactionCreate', handleInteractionCreate);

// ── 봇 로그인 ─────────────────────────────────────────────────
client.login(process.env.DISCORD_BOT_TOKEN).catch((err) => {
  console.error('[Bot] Login failed:', err);
  process.exit(1);
});
