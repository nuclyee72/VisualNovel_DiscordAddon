import { Client } from 'discord.js';

export function handleReady(client: Client) {
  console.log(`[Bot] Logged in as ${client.user?.tag}`);
  console.log(`[Bot] Serving ${client.guilds.cache.size} guild(s)`);

  // 상태 메시지 설정
  client.user?.setPresence({
    activities: [{ name: '🎭 TRPG 비주얼 노벨', type: 4 }],
    status: 'online',
  });
}
