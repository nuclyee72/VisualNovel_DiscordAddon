import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { socket, activeSessions } from '../state';
import { SOCKET_EVENTS } from '../../../../packages/shared/src/index';
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
      const headers = {
        'x-bot-secret': process.env.BOT_SECRET,
        'x-discord-user-id': targetUser.id,
      };
      const res = await axios.get(
        `${backendUrl}/api/sessions/${sessionId}/participant/${targetUser.id}/stats`,
        { headers }
      );
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
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;

      if (status !== undefined) {
        // 요청은 서버에 도달했으나 실패 응답을 받은 경우 (예: 캐릭터 미등록)
        console.error(`[Bot] /mp stats lookup failed with status ${status}:`, err);
        const message =
          status === 404 ? `❌ **${targetUser.displayName}**님의 등록된 캐릭터를 찾을 수 없습니다. 캐릭터를 먼저 등록해주세요.`
          : status === 401 ? '❌ 서버 인증에 실패했습니다. (BOT_SECRET 설정을 확인해주세요)'
          : status === 403 ? '❌ 이 작업을 수행할 권한이 없습니다.'
          : `❌ MP 조회 중 서버 오류가 발생했습니다. (status: ${status})`;
        await interaction.reply({ content: message, ephemeral: true });
        return;
      }

      // 네트워크 오류 등 알 수 없는 오류: 현재 값 없이 이벤트만 발행
      console.error('[Bot] /mp unexpected error:', err);
      socket.emit(SOCKET_EVENTS.MASTER_STATUS, {
        sessionId,
        discordId: targetUser.id,
        field: 'mp',
        delta,
        currentValue: -1,
        maxValue: -1,
      });
      await interaction.reply({ content: `⚠️ MP 변경을 전송했으나 현재 값 조회에 실패했습니다.`, ephemeral: true });
    }
  },
} satisfies SlashCommandType;
