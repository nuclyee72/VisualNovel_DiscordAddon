import { Client, ActivityType } from 'discord.js';

export function handleReady(client: Client) {
  console.log(`[Bot] Logged in as ${client.user?.tag}`);
  console.log(`[Bot] Serving ${client.guilds.cache.size} guild(s)`);

  // 상태 메시지 설정
  // ActivityType.Custom(4)의 경우 Discord UI는 `name`이 아니라 `state`만 표시하므로
  // 실제로 보여줄 텍스트는 반드시 `state`에 넣어야 한다.
  client.user?.setPresence({
    activities: [{ name: '🎭 TRPG 비주얼 노벨', state: '🎭 TRPG 비주얼 노벨', type: ActivityType.Custom }],
    status: 'online',
  });
}
