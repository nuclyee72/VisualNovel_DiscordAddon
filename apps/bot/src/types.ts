import { Collection, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export interface SlashCommandType {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, SlashCommandType>;
  }
}
