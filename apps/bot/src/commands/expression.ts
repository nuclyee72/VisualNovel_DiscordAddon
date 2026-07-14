import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { socket, activeSessions } from '../state';
import { SOCKET_EVENTS } from '../../../../packages/shared/src/index';
import type { SlashCommandType } from '../types';

const EXPRESSION_CHOICES = [
  { name: 'Neutral', value: '#Neutral' },
  { name: 'Happy', value: '#Happy' },
  { name: 'Sad', value: '#Sad' },
  { name: 'Angry', value: '#Angry' },
  { name: 'Surprised', value: '#Surprised' },
  { name: 'Embarrassed', value: '#Embarrassed' },
  { name: 'Scared', value: '#Scared' },
  { name: 'Thinking', value: '#Thinking' },
  { name: 'Custom', value: '#Custom' },
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
