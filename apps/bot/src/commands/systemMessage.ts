import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { socket, activeSessions } from '../state';
import { SOCKET_EVENTS } from '../../../../packages/shared/src/index';
import type { SlashCommandType } from '../types';

export default {
  data: new SlashCommandBuilder()
    .setName('시스템')
    .setDescription('비주얼 노벨 화면에 시스템 메시지를 출력합니다.')
    .addStringOption((opt) =>
      opt.setName('메시지').setDescription('출력할 메시지').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('종류')
        .setDescription('메시지 종류')
        .setRequired(false)
        .addChoices(
          { name: '일반 (파란색)', value: 'info' },
          { name: '경고 (노란색)', value: 'warning' },
          { name: '오류 (빨간색)', value: 'error' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const sessionId = activeSessions.get(guildId);
    if (!sessionId) {
      await interaction.reply({ content: '❌ 활성 세션이 없습니다.', ephemeral: true });
      return;
    }

    const text = interaction.options.getString('메시지', true);
    const level = (interaction.options.getString('종류') ?? 'info') as 'info' | 'warning' | 'error';

    socket.emit(SOCKET_EVENTS.MASTER_SYSTEM, { sessionId, text, level, timestamp: Date.now() });
    await interaction.reply({ content: `📢 시스템 메시지 전송: "${text}"`, ephemeral: true });
  },
} satisfies SlashCommandType;
