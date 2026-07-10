import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { socket, activeSessions } from '../index';
import { SOCKET_EVENTS } from '../../../packages/shared/src/index';
import axios from 'axios';
import type { SlashCommandType } from '../types';

export default {
  data: new SlashCommandBuilder()
    .setName('mp')
    .setDescription('플레이어의 MP를 변경합니다.')
    .addUserOption((opt) => opt.setName('유저').setDescription('대상 플레이어').setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('값').setDescription('변경량 (양수: 회복, 음수: 소모) 예: -20, +10').setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const sessionId = activeSessions.get(guildId);
    if (!sessionId) {
      await interaction.reply({ content: '❌ 활성 세션이 없습니다.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('유저', true);
    const delta = interaction.options.getInteger('값', true);

    try {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
      const res = await axios.get(`${backendUrl}/api/sessions/${sessionId}/participant/${targetUser.id}/stats`);
      const stats = res.data as { mp: { current: number; max: number } };

      const current = stats.mp;
      const newValue = Math.max(0, Math.min(current.current + delta, current.max));

      socket.emit(SOCKET_EVENTS.MASTER_STATUS, {
        sessionId,
        discordId: targetUser.id,
        field: 'mp',
        delta: newValue - current.current,
        currentValue: newValue,
        maxValue: current.max,
      });

      const sign = newValue - current.current >= 0 ? '+' : '';
      await interaction.reply(
        `🔮 **${targetUser.displayName}** MP: ${sign}${newValue - current.current} → **${newValue}/${current.max}**`
      );
    } catch {
      socket.emit(SOCKET_EVENTS.MASTER_STATUS, {
        sessionId,
        discordId: targetUser.id,
        field: 'mp',
        delta,
        currentValue: -1,
        maxValue: -1,
      });
      await interaction.reply({ content: `⚠️ MP 변경을 전송했습니다.`, ephemeral: true });
    }
  },
} satisfies SlashCommandType;
