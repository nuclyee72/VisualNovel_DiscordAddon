import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { socket, activeSessions } from '../state';
import { SOCKET_EVENTS, BGM_PRESETS, extractYoutubeId } from '../../../../packages/shared/src/index';
import type { SlashCommandType } from '../types';

export default {
  data: new SlashCommandBuilder()
    .setName('음악')
    .setDescription('BGM을 YouTube 링크 또는 프리셋으로 전환합니다.')
    .addStringOption((opt) =>
      opt
        .setName('분위기')
        .setDescription('BGM 분위기 프리셋')
        .setRequired(false)
        .addChoices(...BGM_PRESETS.map((p) => ({ name: p.name, value: p.key })))
    )
    .addStringOption((opt) =>
      opt
        .setName('유튜브')
        .setDescription('YouTube URL 또는 Video ID (예: https://youtu.be/xxxxx)')
        .setRequired(false)
    )
    .addNumberOption((opt) =>
      opt
        .setName('볼륨')
        .setDescription('볼륨 (0~100, 기본 50)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(100)
    )
    .addNumberOption((opt) =>
      opt
        .setName('시작')
        .setDescription('재생 시작 위치 (초, 기본 0)')
        .setRequired(false)
        .setMinValue(0)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const sessionId = activeSessions.get(guildId);
    if (!sessionId) {
      await interaction.reply({ content: '❌ 활성 세션이 없습니다.', ephemeral: true });
      return;
    }

    const preset = interaction.options.getString('분위기');
    const youtubeInput = interaction.options.getString('유튜브');
    const volumePercent = interaction.options.getNumber('볼륨') ?? 50;
    const startSeconds = interaction.options.getNumber('시작') ?? 0;

    if (!preset && !youtubeInput) {
      await interaction.reply({ content: '❌ 분위기 프리셋 또는 YouTube URL을 입력해주세요.', ephemeral: true });
      return;
    }

    let youtubeVideoId: string | null = null;
    let bgmName = preset ?? '커스텀';

    if (youtubeInput) {
      youtubeVideoId = extractYoutubeId(youtubeInput);
      if (!youtubeVideoId) {
        await interaction.reply({ content: '❌ 유효한 YouTube URL이 아닙니다.', ephemeral: true });
        return;
      }
    } else if (preset) {
      // 프리셋 기본 ID 사용 (대시보드에서 마스터가 설정한 ID)
      const presetData = BGM_PRESETS.find((p) => p.key === preset);
      bgmName = presetData?.name ?? preset;
      youtubeVideoId = presetData?.defaultYoutubeId || null;
      if (!youtubeVideoId) {
        await interaction.reply({
          content: `⚠️ **${bgmName}** 프리셋에 YouTube ID가 설정되지 않았습니다.\n대시보드 → 세션 설정에서 프리셋 BGM을 등록하거나, \`/음악 유튜브:[URL]\` 로 직접 입력하세요.`,
          ephemeral: true,
        });
        return;
      }
    }

    socket.emit(SOCKET_EVENTS.MASTER_BGM, {
      sessionId,
      name: bgmName,
      youtubeVideoId,
      volume: volumePercent / 100,
      startSeconds,
    });

    await interaction.reply(`🎵 BGM이 **${bgmName}**(으)로 전환되었습니다. (볼륨: ${volumePercent}%)`);
  },
} satisfies SlashCommandType;
