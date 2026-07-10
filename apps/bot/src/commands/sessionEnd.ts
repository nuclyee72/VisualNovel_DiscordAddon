import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { socket, activeSessions } from '../index';
import { SOCKET_EVENTS } from '../../../packages/shared/src/index';
import axios from 'axios';
import type { SlashCommandType } from '../types';

export default {
  data: new SlashCommandBuilder()
    .setName('세션종료')
    .setDescription('현재 진행 중인 비주얼 노벨 세션을 종료하고 로그를 저장합니다.'),

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const sessionId = activeSessions.get(guildId);

    if (!sessionId) {
      await interaction.reply({ content: '❌ 연결된 세션이 없습니다.', ephemeral: true });
      return;
    }

    try {
      // 종료 시스템 메시지
      socket.emit(SOCKET_EVENTS.MASTER_SYSTEM, {
        sessionId,
        text: '📜 마스터가 세션을 종료했습니다. 수고하셨습니다!',
        level: 'info',
        timestamp: Date.now(),
      });

      const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
      // 세션 종료 API 호출
      await axios.delete(`${backendUrl}/api/sessions/${sessionId}`, {
        headers: { 'x-bot-secret': process.env.BOT_SECRET },
      });

      // 길드 → 세션 매핑 제거
      activeSessions.delete(guildId);

      const logUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/sessions`;
      await interaction.reply(
        `✅ **세션 종료 완료!**\n로그는 대시보드에서 다운로드할 수 있습니다.\n${logUrl}`
      );
    } catch (err) {
      console.error('[Bot] /세션종료 error:', err);
      await interaction.reply({ content: '❌ 세션 종료 중 오류가 발생했습니다.', ephemeral: true });
    }
  },
} satisfies SlashCommandType;
