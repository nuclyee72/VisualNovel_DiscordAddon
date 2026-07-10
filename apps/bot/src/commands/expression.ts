import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { socket, activeSessions } from '../index';
import { SOCKET_EVENTS } from '../../../packages/shared/src/index';
import type { SlashCommandType } from '../types';

const EXPRESSION_CHOICES = [
  { name: '기본', value: '#기본' },
  { name: '웃음', value: '#웃음' },
  { name: '슬픔', value: '#슬픔' },
  { name: '분노', value: '#분노' },
  { name: '전투', value: '#전투' },
  { name: '놀람', value: '#놀람' },
  { name: '생각', value: '#생각' },
];

export default {
  data: new SlashCommandBuilder()
    .setName('표정')
    .setDescription('내 캐릭터 스탠딩 이미지의 표정을 변경합니다.')
    .addStringOption((opt) =>
      opt
        .setName('태그')
        .setDescription('표정 태그')
        .setRequired(true)
        .addChoices(...EXPRESSION_CHOICES)
    )
    .addUserOption((opt) =>
      opt.setName('유저').setDescription('대상 유저 (기본: 본인)').setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const sessionId = activeSessions.get(guildId);
    if (!sessionId) {
      await interaction.reply({ content: '❌ 활성 세션이 없습니다.', ephemeral: true });
      return;
    }

    const tag = interaction.options.getString('태그', true);
    const targetUser = interaction.options.getUser('유저') ?? interaction.user;

    socket.emit(SOCKET_EVENTS.MASTER_EXPRESSION, {
      sessionId,
      discordId: targetUser.id,
      tag,
    });

    const label = EXPRESSION_CHOICES.find((c) => c.value === tag)?.name ?? tag;
    await interaction.reply({ content: `😊 **${targetUser.displayName}**의 표정이 **${label}**(으)로 변경되었습니다.`, ephemeral: false });
  },
} satisfies SlashCommandType;
