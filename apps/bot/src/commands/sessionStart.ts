import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { socket, activeSessions } from '../index';
import { SOCKET_EVENTS } from '../../../packages/shared/src/index';
import axios from 'axios';
import type { SlashCommandType } from '../types';

export default {
  data: new SlashCommandBuilder()
    .setName('세션시작')
    .setDescription('디스코드 채널을 비주얼 노벨 세션과 연결합니다.')
    .addStringOption((opt) =>
      opt.setName('세션id').setDescription('연결할 세션 ID (웹 대시보드에서 확인)').setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const sessionId = interaction.options.getString('세션id', true);

    try {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
      // 세션 유효성 확인
      const res = await axios.get(`${backendUrl}/api/sessions/${sessionId}`);
      const session = res.data as { name: string; status: string; masterId: string };

      if (session.status === 'ended') {
        await interaction.reply({ content: '❌ 이미 종료된 세션입니다.', ephemeral: true });
        return;
      }

      // 현재 길드에 세션 매핑
      activeSessions.set(guildId, sessionId);

      // Socket.IO 룸 입장
      socket.emit('client:join_session', { sessionId });

      // 세션 시작 신호
      await axios.patch(`${backendUrl}/api/sessions/${sessionId}/start`);

      // 시스템 메시지 브로드캐스트
      socket.emit(SOCKET_EVENTS.MASTER_SYSTEM, {
        sessionId,
        text: `📜 세션 "${session.name}" 시작! 모든 플레이어가 접속하면 어드벤처를 시작하세요.`,
        level: 'info',
        timestamp: Date.now(),
      });

      const webUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/session/${sessionId}`;
      await interaction.reply(
        `✅ **세션 연결 완료!**\n` +
        `세션명: **${session.name}**\n` +
        `🌐 웹 뷰어: ${webUrl}\n` +
        `위 링크를 플레이어들에게 공유하세요.`
      );
    } catch (err) {
      console.error('[Bot] /세션시작 error:', err);
      await interaction.reply({ content: '❌ 세션을 찾을 수 없습니다. ID를 확인해주세요.', ephemeral: true });
    }
  },
} satisfies SlashCommandType;
