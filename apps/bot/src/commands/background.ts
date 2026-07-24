import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { socket, activeSessions } from '../state';
import { SOCKET_EVENTS, BACKGROUND_PRESETS, extractYoutubeId } from '@vn-trpg/shared';
import type { SlashCommandType } from '../types';

export default {
  data: new SlashCommandBuilder()
    .setName('배경')
    .setDescription('비주얼 노벨 배경 이미지를 전환합니다.')
    .addStringOption((opt) =>
      opt
        .setName('장소')
        .setDescription('배경 이름 또는 커스텀 이미지 URL')
        .setRequired(true)
        .addChoices(
          ...BACKGROUND_PRESETS.map((p) => ({ name: p.name, value: p.key })),
          { name: '커스텀 URL', value: 'custom' }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('url')
        .setDescription('커스텀 배경 이미지 URL (장소를 "커스텀 URL"로 선택 시)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const sessionId = activeSessions.get(guildId);
    if (!sessionId) {
      await interaction.reply({ content: '❌ 활성 세션이 없습니다. `/세션시작` 으로 세션을 먼저 연결하세요.', ephemeral: true });
      return;
    }

    const place = interaction.options.getString('장소', true);
    let bgName = place;
    let bgUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/assets/backgrounds/${place}.jpg`;

    if (place === 'custom') {
      const customUrl = interaction.options.getString('url');
      if (!customUrl) {
        await interaction.reply({ content: '❌ 커스텀 URL을 입력해주세요.', ephemeral: true });
        return;
      }
      bgUrl = customUrl;
      bgName = '커스텀';
    }

    socket.emit(SOCKET_EVENTS.MASTER_BACKGROUND, {
      sessionId,
      name: bgName,
      url: bgUrl,
    });

    await interaction.reply(`🖼️ 배경이 **${bgName}**(으)로 전환되었습니다.`);
  },
} satisfies SlashCommandType;
