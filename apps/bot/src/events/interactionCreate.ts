import { Interaction, ChatInputCommandInteraction } from 'discord.js';
import { client } from '../index';

export async function handleInteractionCreate(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.warn(`[Bot] Unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction as ChatInputCommandInteraction);
  } catch (err) {
    console.error(`[Bot] Command error (${interaction.commandName}):`, err);
    const errorMsg = { content: '❌ 명령어 처리 중 오류가 발생했습니다.', ephemeral: true };
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMsg);
      } else {
        await interaction.reply(errorMsg);
      }
    } catch (replyErr) {
      // 인터랙션 토큰 만료 등으로 응답 자체가 실패할 수 있으므로 여기서 전파하지 않는다.
      console.error(`[Bot] Failed to notify user of command error (${interaction.commandName}):`, replyErr);
    }
  }
}
