import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { socket, activeSessions } from '../state';
import { SOCKET_EVENTS, parseDiceFormula, rollDice } from '@vn-trpg/shared';
import type { SlashCommandType } from '../types';

export default {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('주사위를 굴립니다. 예: /roll 2d6+3')
    .addStringOption((opt) =>
      opt
        .setName('주사위식')
        .setDescription('주사위 식 (예: d20, 2d6, d8+3, 4d6-1)')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const sessionId = activeSessions.get(guildId);

    const formula = interaction.options.getString('주사위식', true).toLowerCase().trim();
    const parsed = parseDiceFormula(formula);

    if (!parsed) {
      await interaction.reply({
        content: '❌ 잘못된 주사위 식입니다. 예시: `d20`, `2d6`, `d8+3`',
        ephemeral: true,
      });
      return;
    }

    if (parsed.diceCount > 20) {
      await interaction.reply({ content: '❌ 한 번에 최대 20개의 주사위만 굴릴 수 있습니다.', ephemeral: true });
      return;
    }

    const rolls = rollDice(parsed);
    const total = rolls.reduce((sum, r) => sum + r, 0) + parsed.modifier;

    // 텍스트 결과 (Discord 채널에도 출력)
    const rollsStr = rolls.join(' + ');
    const modStr = parsed.modifier !== 0 ? ` ${parsed.modifier > 0 ? '+' : ''}${parsed.modifier}` : '';
    const resultMsg = `🎲 **${interaction.user.displayName}** | \`${formula}\` → [${rollsStr}]${modStr} = **${total}**`;

    await interaction.reply(resultMsg);

    // 세션이 있으면 웹 화면 애니메이션도 표시
    if (sessionId) {
      socket.emit(SOCKET_EVENTS.MASTER_DICE, {
        sessionId,
        discordId: interaction.user.id,
        userName: interaction.user.displayName,
        formula,
        rolls,
        modifier: parsed.modifier,
        total,
        timestamp: Date.now(),
      });
    }
  },
} satisfies SlashCommandType;
