import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { socket, activeSessions } from '../state';
import { SOCKET_EVENTS } from '@vn-trpg/shared';
import axios from 'axios';
import type { SlashCommandType } from '../types';

async function changeStatus(
  interaction: ChatInputCommandInteraction,
  field: 'hp' | 'mp'
) {
  const guildId = interaction.guildId!;
  const sessionId = activeSessions.get(guildId);
  if (!sessionId) {
    await interaction.reply({ content: '❌ 활성 세션이 없습니다.', ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser('유저', true);
  const delta = interaction.options.getInteger('값', true);
  const label = field.toUpperCase();

  try {
    // 서버에서 캐릭터 현재 스탯 조회
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    const headers = {
      'x-bot-secret': process.env.BOT_SECRET,
      'x-discord-user-id': targetUser.id,
    };
    const res = await axios.get(
      `${backendUrl}/api/sessions/${sessionId}/participant/${targetUser.id}/stats`,
      { headers }
    );
    const stats = res.data as { hp: { current: number; max: number }; mp: { current: number; max: number } };

    const currentStat = stats[field];
    const newValue = Math.max(0, Math.min(currentStat.current + delta, currentStat.max));
    const actualDelta = newValue - currentStat.current;

    // 서버 + 웹 소켓에 상태 업데이트 전송
    socket.emit(SOCKET_EVENTS.MASTER_STATUS, {
      sessionId,
      discordId: targetUser.id,
      field,
      delta: actualDelta,
      currentValue: newValue,
      maxValue: currentStat.max,
    });

    const arrow = actualDelta >= 0 ? '▲' : '▼';
    const sign = actualDelta >= 0 ? '+' : '';
    await interaction.reply(
      `📊 **${targetUser.displayName}** ${label}: ${sign}${actualDelta} → **${newValue}/${currentStat.max}** ${arrow}`
    );
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;

    if (status !== undefined) {
      // 요청은 서버에 도달했으나 실패 응답을 받은 경우 (예: 캐릭터 미등록)
      console.error(`[Bot] /${field} stats lookup failed with status ${status}:`, err);
      const message =
        status === 404 ? `❌ **${targetUser.displayName}**님의 등록된 캐릭터를 찾을 수 없습니다. 캐릭터를 먼저 등록해주세요.`
        : status === 401 ? '❌ 서버 인증에 실패했습니다. (BOT_SECRET 설정을 확인해주세요)'
        : status === 403 ? '❌ 이 작업을 수행할 권한이 없습니다.'
        : `❌ ${label} 조회 중 서버 오류가 발생했습니다. (status: ${status})`;
      await interaction.reply({ content: message, ephemeral: true });
      return;
    }

    // 네트워크 오류 등 알 수 없는 오류: 현재 값 없이 이벤트만 발행
    console.error(`[Bot] /${field} unexpected error:`, err);
    socket.emit(SOCKET_EVENTS.MASTER_STATUS, {
      sessionId,
      discordId: targetUser.id,
      field,
      delta,
      currentValue: -1,   // -1: 클라이언트가 자체 계산
      maxValue: -1,
    });
    await interaction.reply({ content: `⚠️ ${label} 변경을 전송했으나 현재 값 조회에 실패했습니다.`, ephemeral: true });
  }
}

export const hpCommand: SlashCommandType = {
  data: new SlashCommandBuilder()
    .setName('hp')
    .setDescription('플레이어의 HP를 변경합니다.')
    .addUserOption((opt) => opt.setName('유저').setDescription('대상 플레이어').setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('값').setDescription('변경량 (양수: 회복, 음수: 피해) 예: -10, +5').setRequired(true)
    ),
  async execute(interaction) {
    await changeStatus(interaction, 'hp');
  },
};

export default hpCommand;
