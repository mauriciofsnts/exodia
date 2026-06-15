import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  ChatInputCommandInteraction,
  Client,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  Message,
  MessageReplyOptions,
  VoiceBasedChannel,
} from "discord.js";
import { ApplicationCommandOptionType, GuildMember, MessageFlags } from "discord.js";
import { guildLocaleKey, type Locale } from "@/i18n/index.js";
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

      // Stored /setlang preference wins; Discord's locale is only the fallback.
      const locale = await resolveLocale(
        ctx,
        interaction.guildId,
        interaction.guildLocale ?? interaction.locale,
      );
      const execCtx = buildSlashContext(ctx, interaction, command, locale);
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

      const locale = await resolveLocale(ctx, message.guildId);
      const execCtx = buildPrefixContext(ctx, message, tokens, command, locale);
      await safeExecute(command, execCtx, ctx, this.globalMiddlewares);
    });
  }
}

async function resolveLocale(
  ctx: BotContext,
  guildId: string | null,
  discordLocale?: string | null,
): Promise<Locale> {
  const stored = guildId ? await ctx.cache.get(guildLocaleKey(guildId)) : null;
  return ctx.i18n.resolveLocale(stored ?? discordLocale);
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
        flags: MessageFlags.Ephemeral,
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
    const isLast = i === options.length - 1;
    // The trailing string option is greedy: it swallows the remaining tokens so
    // multi-word values (e.g. a search query like `!play never gonna give you up`)
    // aren't truncated to the first word.
    const token =
      isLast && opt.type === ApplicationCommandOptionType.String
        ? tokens.slice(i).join(" ") || null
        : (tokens[i] ?? null);
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
  command: CommandDefinition,
  locale: Locale,
): CommandExecutionContext {
  const member = interaction.member instanceof GuildMember ? interaction.member : null;

  return {
    bot,
    commandName: command.name,
    args: buildSlashArgs(interaction, command.options) as never,
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
    textChannel: interaction.channel,
    defer: (ephemeral) =>
      interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {}).then(() => {}),
    reply: (content) => {
      const payload = typeof content === "string" ? { content } : content;
      // After defer(), fill the pending "thinking…" response via editReply;
      // once a real reply exists, additional messages go through followUp.
      if (interaction.deferred && !interaction.replied) {
        return interaction.editReply(payload as InteractionEditReplyOptions).then(() => {});
      }
      return interaction.replied
        ? interaction.followUp(payload as InteractionReplyOptions).then(() => {})
        : interaction.reply(payload as InteractionReplyOptions).then(() => {});
    },
  };
}

function buildPrefixContext(
  bot: BotContext,
  message: Message,
  tokens: string[],
  command: CommandDefinition,
  locale: Locale,
): CommandExecutionContext {
  return {
    bot,
    commandName: command.name,
    args: buildPrefixArgs(tokens, command.options) as never,
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
    textChannel: message.channel,
    defer: () => {
      // Prefix commands have no deferral — a typing indicator is the closest signal.
      return message.channel.isSendable()
        ? message.channel.sendTyping().catch(() => {})
        : Promise.resolve();
    },
    reply: (content) => {
      if (typeof content === "string") return message.reply(content).then(() => {});
      // Keep rich content (embeds/components/files); drop interaction-only fields.
      const { content: text, embeds, components, files } = content as MessageReplyOptions;
      return message.reply({ content: text, embeds, components, files }).then(() => {});
    },
  };
}
