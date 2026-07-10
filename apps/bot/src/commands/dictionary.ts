import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import axios from 'axios';
import type { SlashCommandType } from '../types';

export default {
  data: new SlashCommandBuilder()
    .setName('사전등록')
    .setDescription('세션 사전에 고유명사를 등록합니다. (툴팁으로 표시됨)')
    .addStringOption((opt) => opt.setName('단어').setDescription('등록할 단어').setRequired(true))
    .addStringOption((opt) => opt.setName('설명').setDescription('단어 설명').setRequired(true))
    .addStringOption((opt) =>
      opt.setName('카테고리').setDescription('카테고리 (예: 인물, 지명, 마법)').setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const word = interaction.options.getString('단어', true);
    const description = interaction.options.getString('설명', true);
    const category = interaction.options.getString('카테고리') ?? undefined;
    const guildId = interaction.guildId!;

    try {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
      await axios.post(
        `${backendUrl}/api/dictionary`,
        { guildId, word, description, category },
        { headers: { 'x-bot-secret': process.env.BOT_SECRET } }
      );
      await interaction.reply(`📖 사전에 **${word}** 등록 완료!\n> ${description}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      if (error.response?.data?.error?.includes('이미 등록')) {
        await interaction.reply({ content: `⚠️ **${word}**은(는) 이미 등록된 단어입니다.`, ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ 사전 등록 중 오류가 발생했습니다.', ephemeral: true });
      }
    }
  },
} satisfies SlashCommandType;
