import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { socket, activeSessions } from '../index';
import { SOCKET_EVENTS } from '../../../packages/shared/src/index';
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
    const res = await axios.get(`${backendUrl}/api/sessions/${sessionId}/participant/${targetUser.id}/stats`);
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
  } catch {
    // 서버 조회 실패 시에도 이벤트는 발행 (현재 값 없이)
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
