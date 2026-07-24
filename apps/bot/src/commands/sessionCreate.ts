import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { socket, activeSessions } from '../state';
import { SOCKET_EVENTS } from '@vn-trpg/shared';
import axios from 'axios';
import type { SlashCommandType } from '../types';

export default {
  data: new SlashCommandBuilder()
    .setName('세션생성')
    .setDescription('이 디스코드 서버에서 바로 비주얼 노벨 세션을 만들고 시작합니다.')
    .addStringOption((opt) =>
      opt.setName('이름').setDescription('세션 이름 (기본: 서버 이름 기반)').setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: '❌ 디스코드 서버 채널에서만 사용할 수 있습니다.', ephemeral: true });
      return;
    }

    const name = interaction.options.getString('이름') || `${interaction.guild?.name ?? '디스코드'} 세션`;

    try {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
      const headers = {
        'x-bot-secret': process.env.BOT_SECRET,
        'x-discord-user-id': interaction.user.id,
      };

      // 세션 생성 — 서버가 없으면 유저 문서까지 함께 만들어주므로 웹 로그인 없이도 진행된다.
      const createRes = await axios.post(
        `${backendUrl}/api/sessions`,
        {
          name,
          guildId,
          masterUserName: interaction.user.displayName ?? interaction.user.username,
          masterAvatarUrl: interaction.user.displayAvatarURL(),
        },
        { headers }
      );
      const sessionId = createRes.data.session.sessionId as string;

      // 생성과 동시에 바로 시작 상태로 전환 (별도로 /세션시작을 또 칠 필요가 없도록)
      await axios.patch(`${backendUrl}/api/sessions/${sessionId}/start`, {}, { headers });

      // 현재 길드에 세션 매핑 + 소켓 룸 입장
      activeSessions.set(guildId, sessionId);
      socket.emit('client:join_session', { sessionId });

      socket.emit(SOCKET_EVENTS.MASTER_SYSTEM, {
        sessionId,
        text: `📜 세션 "${name}" 시작! 아래 링크로 모두 접속하세요.`,
        level: 'info',
        timestamp: Date.now(),
      });

      const webUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/session/${sessionId}?guildId=${guildId}`;
      await interaction.reply(
        `✅ **세션 생성 완료!**\n` +
        `세션명: **${name}**\n` +
        `🌐 웹 뷰어: ${webUrl}\n` +
        `이 서버 멤버라면 누구나 별도 참가 절차 없이 위 링크로 바로 입장할 수 있습니다.`
      );
    } catch (err) {
      console.error('[Bot] /세션생성 error:', err);
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const message =
        status === 401 ? '❌ 서버 인증에 실패했습니다. (BOT_SECRET 설정을 확인해주세요)'
        : '❌ 세션 생성 중 오류가 발생했습니다.';
      await interaction.reply({ content: message, ephemeral: true });
    }
  },
} satisfies SlashCommandType;
