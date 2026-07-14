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

// DISCORD_GUILD_ID를 바꿔가며 스크립트를 재실행하면 이전에 사용하던 스코프에
// 커맨드가 그대로 남아 중복(예: 같은 커맨드가 두 번 보임)이 발생할 수 있다.
// 현재 등록에 사용하지 않는 스코프는 빈 배열로 덮어써서 정리한다.
async function clearOtherScope(clientId: string, guildId: string | undefined) {
  if (guildId) {
    // 이번에는 길드 스코프로 등록했으므로, 이전에 남아있을 수 있는 글로벌 커맨드를 정리한다.
    try {
      await rest.put(Routes.applicationCommands(clientId), { body: [] });
      console.log('🧹 이전 글로벌 커맨드를 정리했습니다 (중복 방지)');
    } catch (err) {
      console.warn('⚠️ 글로벌 커맨드 정리 실패 (무시하고 계속 진행):', err);
    }
    return;
  }

  // 이번에는 글로벌 스코프로 등록했으므로, 봇이 속한 모든 길드의 길드 스코프 커맨드를 정리한다.
  try {
    const guilds = (await rest.get(Routes.userGuilds())) as Array<{ id: string }>;
    for (const guild of guilds) {
      try {
        await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: [] });
      } catch (err) {
        console.warn(`⚠️ 길드(${guild.id}) 커맨드 정리 실패 (무시하고 계속 진행):`, err);
      }
    }
    if (guilds.length > 0) {
      console.log(`🧹 이전 길드 스코프 커맨드를 정리했습니다 (${guilds.length}개 길드, 중복 방지)`);
    }
  } catch (err) {
    console.warn('⚠️ 길드 목록 조회 실패, 길드 스코프 커맨드 정리를 건너뜁니다:', err);
  }
}

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

    // 반대 스코프에 남아있을 수 있는 이전 등록분을 정리 (스코프 전환 시 중복 방지)
    await clearOtherScope(clientId, guildId);

    console.log('\n등록된 커맨드:');
    commands.forEach((cmd) => console.log(`  - /${cmd.name}: ${cmd.description}`));
  } catch (err) {
    console.error('❌ 커맨드 등록 실패:', err);
    process.exit(1);
  }
}

registerCommands();
