import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

// 모든 커맨드 임포트
import backgroundCmd from '../commands/background';
import bgmCmd from '../commands/bgm';
import rollCmd from '../commands/roll';
import hpCmd from '../commands/hp';
import mpCmd from '../commands/mp';
import sessionStartCmd from '../commands/sessionStart';
import sessionEndCmd from '../commands/sessionEnd';
import expressionCmd from '../commands/expression';
import systemMsgCmd from '../commands/systemMessage';
import dictionaryCmd from '../commands/dictionary';

const commands = [
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
].map((cmd) => cmd.data.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!);

async function registerCommands() {
  const clientId = process.env.DISCORD_CLIENT_ID!;
  const guildId = process.env.DISCORD_GUILD_ID;

  try {
    console.log(`📝 ${commands.length}개 슬래시 커맨드 등록 중...`);

    if (guildId) {
      // 개발: 특정 길드에만 등록 (즉시 반영)
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`✅ 길드 커맨드 등록 완료 (Guild: ${guildId})`);
    } else {
      // 프로덕션: 글로벌 등록 (최대 1시간 반영 지연)
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('✅ 글로벌 커맨드 등록 완료 (반영까지 최대 1시간 소요)');
    }

    console.log('\n등록된 커맨드:');
    commands.forEach((cmd) => console.log(`  - /${cmd.name}: ${cmd.description}`));
  } catch (err) {
    console.error('❌ 커맨드 등록 실패:', err);
    process.exit(1);
  }
}

registerCommands();
