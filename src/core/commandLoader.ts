import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  ChatInputCommandInteraction,
  Client,
  InteractionReplyOptions,
  Message,
  MessageReplyOptions,
  VoiceBasedChannel,
} from "discord.js";
import { ApplicationCommandOptionType, GuildMember } from "discord.js";
import type { Locale } from "@/i18n/index.js";
import { CommandError } from "@/lib/errors.js";
import type {
  CommandDefinition,
  CommandExecutionContext,
  Middleware,
  OptionDef,
} from "./commandBuilder.js";
import { composeMiddlewares } from "./commandBuilder.js";
import type { BotContext } from "./context.js";

export class CommandLoader {
  private commands = new Map<string, CommandDefinition>();
  private prefixCommands = new Map<string, CommandDefinition>();
  private globalMiddlewares: Middleware[] = [];

  use(middleware: Middleware): this {
    this.globalMiddlewares.push(middleware);
    return this;
  }

  async load(commandsDir: string): Promise<void> {
    const files = collectFiles(commandsDir);

    for (const file of files) {
      const mod = await import(pathToFileURL(file).href);
      const definition: CommandDefinition | undefined = mod.default ?? mod.command;

      if (!definition || typeof definition.execute !== "function") continue;

      this.commands.set(definition.name, definition);

      if (definition.prefix) {
        this.prefixCommands.set(definition.prefix.toLowerCase(), definition);
      }
    }
  }

  get all(): CommandDefinition[] {
    return [...this.commands.values()];
  }

  registerInteractionHandler(client: Client, ctx: BotContext): void {
    client.on("interactionCreate", async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const command = this.commands.get(interaction.commandName);
      if (!command) return;

      const locale = ctx.i18n.resolveLocale(interaction.guildLocale ?? interaction.locale);
      const execCtx = buildSlashContext(ctx, interaction, command.options, locale);
      await safeExecute(command, execCtx, ctx, this.globalMiddlewares);
    });
  }

  registerPrefixHandler(client: Client, ctx: BotContext): void {
    const { PREFIX } = ctx.config;

    client.on("messageCreate", async (message) => {
      if (message.author.bot) return;
      if (!message.content.startsWith(PREFIX)) return;

      const [rawCommand, ...tokens] = message.content.slice(PREFIX.length).trim().split(/\s+/);
      const command = this.prefixCommands.get(rawCommand.toLowerCase());
      if (!command) return;

      const rawLocale = message.guildId
        ? await ctx.cache.get(`guild:${message.guildId}:locale`)
        : null;
      const locale = ctx.i18n.resolveLocale(rawLocale);
      const execCtx = buildPrefixContext(ctx, message, tokens, command.options, locale);
      await safeExecute(command, execCtx, ctx, this.globalMiddlewares);
    });
  }
}

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...collectFiles(full));
    else if (entry.endsWith(".ts") || entry.endsWith(".js")) files.push(full);
  }
  return files;
}

async function safeExecute(
  command: CommandDefinition,
  ctx: CommandExecutionContext,
  botCtx: BotContext,
  globalMiddlewares: Middleware[],
): Promise<void> {
  const pipeline = composeMiddlewares(
    [...globalMiddlewares, ...command.middlewares],
    command.execute,
  );

  try {
    await pipeline(ctx);
  } catch (err) {
    const msg =
      err instanceof CommandError ? err.message : "Ocorreu um erro ao executar esse comando.";
    botCtx.logger.error({ err, command: command.name }, "Command execution failed");
    try {
      await ctx.reply({
        content: `❌ ${msg}`,
        ephemeral: true,
      } as InteractionReplyOptions);
    } catch {
      // reply already sent or interaction expired
    }
  }
}

function buildSlashArgs(
  interaction: ChatInputCommandInteraction,
  options: OptionDef[],
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const opt of options) {
    const req = !!opt.required;
    switch (opt.type) {
      case ApplicationCommandOptionType.String:
        args[opt.name] = interaction.options.getString(opt.name, req);
        break;
      case ApplicationCommandOptionType.Integer:
        args[opt.name] = interaction.options.getInteger(opt.name, req);
        break;
      case ApplicationCommandOptionType.Boolean:
        args[opt.name] = interaction.options.getBoolean(opt.name, req);
        break;
      case ApplicationCommandOptionType.Number:
        args[opt.name] = interaction.options.getNumber(opt.name, req);
        break;
    }
  }
  return args;
}

function buildPrefixArgs(tokens: string[], options: OptionDef[]): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const token = tokens[i] ?? null;
    if (opt.required && token === null) {
      throw new CommandError(`Argumento "${opt.name}" é obrigatório.`);
    }
    switch (opt.type) {
      case ApplicationCommandOptionType.String:
        args[opt.name] = token;
        break;
      case ApplicationCommandOptionType.Integer:
        args[opt.name] = token !== null ? parseInt(token, 10) : null;
        break;
      case ApplicationCommandOptionType.Boolean:
        args[opt.name] = token !== null ? token === "true" : null;
        break;
      case ApplicationCommandOptionType.Number:
        args[opt.name] = token !== null ? parseFloat(token) : null;
        break;
    }
  }
  return args;
}

function resolveVoiceChannel(member: GuildMember | null): VoiceBasedChannel | null {
  return member?.voice?.channel ?? null;
}

function buildSlashContext(
  bot: BotContext,
  interaction: ChatInputCommandInteraction,
  options: OptionDef[],
  locale: Locale,
): CommandExecutionContext {
  const member = interaction.member instanceof GuildMember ? interaction.member : null;

  return {
    bot,
    args: buildSlashArgs(interaction, options) as never,
    raw: [],
    interaction,
    message: null,
    source: interaction.guildId ? "guild" : "dm",
    locale,
    t: bot.i18n.bind(locale),
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    userId: interaction.user.id,
    displayName: interaction.user.displayName,
    memberPermissions: member?.permissions ?? interaction.memberPermissions,
    voiceChannel: resolveVoiceChannel(member),
    reply: (content) => {
      const payload = typeof content === "string" ? { content } : content;
      return interaction.replied || interaction.deferred
        ? interaction.followUp(payload as InteractionReplyOptions).then(() => {})
        : interaction.reply(payload as InteractionReplyOptions).then(() => {});
    },
  };
}

function buildPrefixContext(
  bot: BotContext,
  message: Message,
  tokens: string[],
  options: OptionDef[],
  locale: Locale,
): CommandExecutionContext {
  return {
    bot,
    args: buildPrefixArgs(tokens, options) as never,
    raw: tokens,
    interaction: null,
    message,
    source: message.guildId ? "guild" : "dm",
    locale,
    t: bot.i18n.bind(locale),
    guildId: message.guildId,
    channelId: message.channelId,
    userId: message.author.id,
    displayName: message.author.displayName,
    memberPermissions: message.member?.permissions ?? null,
    voiceChannel: resolveVoiceChannel(message.member),
    reply: (content) => {
      const text =
        typeof content === "string" ? content : ((content as MessageReplyOptions).content ?? "");
      return message.reply(text).then(() => {});
    },
  };
}
