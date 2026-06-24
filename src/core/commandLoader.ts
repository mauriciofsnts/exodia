import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Client,
  InteractionEditReplyOptions,
  InteractionReplyOptions,
  Message,
  MessageComponentInteraction,
  MessageReaction,
  MessageReplyOptions,
  PartialMessageReaction,
  PartialUser,
  User,
  VoiceBasedChannel,
} from "discord.js";
import { ApplicationCommandOptionType, GuildMember, MessageFlags } from "discord.js";
import type { Locale, TFunction } from "@/i18n/index";
import { CommandError, PlayerError } from "@/lib/errors";
import { notifyAdmin } from "@/middlewares/adminErrorNotifier";
import type {
  CommandDefinition,
  CommandExecutionContext,
  ComponentHandler,
  Middleware,
  OptionDef,
  ReactionHandlerDef,
} from "./commandBuilder";
import { composeMiddlewares } from "./commandBuilder";
import type { BotContext } from "./context";

export class CommandLoader {
  private commands = new Map<string, CommandDefinition>();
  private prefixCommands = new Map<string, CommandDefinition>();
  private globalMiddlewares: Middleware[] = [];
  private componentHandlers = new Map<string, ComponentHandler>();
  private reactionHandlers: ReactionHandlerDef[] = [];

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

      for (const component of definition.components) {
        this.componentHandlers.set(component.prefix, component.handle);
      }
      this.reactionHandlers.push(...definition.reactions);
    }
  }

  get all(): CommandDefinition[] {
    return [...this.commands.values()];
  }

  registerInteractionHandler(client: Client, ctx: BotContext): void {
    client.on("interactionCreate", async (interaction) => {
      if (interaction.isChatInputCommand()) {
        const command = this.commands.get(interaction.commandName);
        if (!command) return;

        // Stored /setup language preference wins; Discord's locale is only the fallback.
        const locale = await resolveLocale(
          ctx,
          interaction.guildId,
          interaction.guildLocale ?? interaction.locale,
        );
        const execCtx = buildSlashContext(ctx, interaction, command, locale);
        await safeExecute(command, execCtx, ctx, this.globalMiddlewares);
        return;
      }

      if (interaction.isMessageComponent()) {
        await this.dispatchComponent(interaction, ctx);
        return;
      }

      if (interaction.isAutocomplete()) {
        await this.dispatchAutocomplete(interaction, ctx);
      }
    });
  }

  private async dispatchAutocomplete(
    interaction: AutocompleteInteraction,
    ctx: BotContext,
  ): Promise<void> {
    const command = this.commands.get(interaction.commandName);
    if (!command) return;

    const focused = interaction.options.getFocused(true);
    const option = command.options.find((o) => o.name === focused.name);
    if (!option?.autocomplete) return;

    const locale = await resolveLocale(
      ctx,
      interaction.guildId,
      interaction.guildLocale ?? interaction.locale,
    );

    try {
      const choices = await option.autocomplete({
        bot: ctx,
        interaction,
        value: String(focused.value ?? ""),
        guildId: interaction.guildId,
        locale,
        t: ctx.i18n.bind(locale),
      });
      // Discord caps autocomplete at 25 choices.
      await interaction.respond(choices.slice(0, 25));
    } catch (err) {
      ctx.logger.error({ err, command: command.name }, "Autocomplete failed");
      await interaction.respond([]).catch(() => {});
    }
  }

  private async dispatchComponent(
    interaction: MessageComponentInteraction,
    ctx: BotContext,
  ): Promise<void> {
    // customId routing: "<prefix>:<...args>" → handler registered for <prefix>.
    const [prefix, ...args] = interaction.customId.split(":");
    const handler = this.componentHandlers.get(prefix);
    if (!handler) return;

    const locale = await resolveLocale(
      ctx,
      interaction.guildId,
      interaction.guildLocale ?? interaction.locale,
    );

    try {
      await handler({
        bot: ctx,
        interaction,
        customId: interaction.customId,
        args,
        guildId: interaction.guildId,
        userId: interaction.user.id,
        locale,
        t: ctx.i18n.bind(locale),
      });
    } catch (err) {
      ctx.logger.error({ err, customId: interaction.customId }, "Component handler failed");
      // Component handlers run outside the command middleware, so surface unexpected
      // (non-user-facing) faults to the admin here.
      if (!(err instanceof CommandError) && !(err instanceof PlayerError)) {
        await notifyAdmin(ctx, err, {
          label: `component:${prefix}`,
          source: "component",
          userId: interaction.user.id,
          guildId: interaction.guildId,
        }).catch(() => {});
      }
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "❌", flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  }

  registerReactionHandler(client: Client, ctx: BotContext): void {
    if (this.reactionHandlers.length === 0) return;

    const dispatch = async (
      rawReaction: MessageReaction | PartialMessageReaction,
      rawUser: User | PartialUser,
      event: "add" | "remove",
    ): Promise<void> => {
      // The emoji is resolved even on partial reactions, so filter first and
      // bail before any fetch when no handler cares about this emoji — avoids an
      // API round trip per stray reaction on busy servers.
      const emoji = rawReaction.emoji.name ?? rawReaction.emoji.id ?? "";
      const handlers = this.reactionHandlers.filter((h) => !h.emojis || h.emojis.includes(emoji));
      if (handlers.length === 0) return;
      if (rawUser.bot) return; // PartialUser still exposes `bot`

      let reaction: MessageReaction;
      let user: User;
      try {
        // Reactions on uncached messages arrive partial — resolve before dispatch.
        reaction = rawReaction.partial ? await rawReaction.fetch() : rawReaction;
        user = rawUser.partial ? await rawUser.fetch() : rawUser;
      } catch {
        return; // message or user no longer reachable
      }
      if (user.bot) return;

      for (const { handle } of handlers) {
        try {
          await handle({ bot: ctx, reaction, user, emoji, event });
        } catch (err) {
          ctx.logger.error({ err, emoji }, "Reaction handler failed");
        }
      }
    };

    client.on("messageReactionAdd", (r, u) => {
      dispatch(r, u, "add").catch(() => {});
    });
    client.on("messageReactionRemove", (r, u) => {
      dispatch(r, u, "remove").catch(() => {});
    });
  }

  registerPrefixHandler(client: Client, ctx: BotContext): void {
    client.on("messageCreate", async (message) => {
      if (message.author.bot) return;

      // Per-guild prefix (cached in memory after the first lookup).
      const prefix = await ctx.guildConfig.resolvePrefix(message.guildId);
      if (!message.content.startsWith(prefix)) return;

      const [rawCommand, ...tokens] = message.content.slice(prefix.length).trim().split(/\s+/);
      const command = this.prefixCommands.get(rawCommand.toLowerCase());
      if (!command) return;

      const locale = await resolveLocale(ctx, message.guildId);
      const execCtx = buildPrefixContext(ctx, message, tokens, command, locale, prefix);
      await safeExecute(command, execCtx, ctx, this.globalMiddlewares);
    });
  }
}

async function resolveLocale(
  ctx: BotContext,
  guildId: string | null,
  discordLocale?: string | null,
): Promise<Locale> {
  const stored = await ctx.guildConfig.resolveLocale(guildId);
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
      err instanceof CommandError || err instanceof PlayerError
        ? err.message
        : ctx.t("errors.generic");
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

// A human-readable invocation hint, e.g. `!play <query>` — required options are
// shown in <angle> brackets, optional ones in [square] brackets. Surfaced to the
// user when a required prefix argument is missing.
function formatUsage(prefix: string, command: CommandDefinition): string {
  const parts = command.options.map((o) => (o.required ? `<${o.name}>` : `[${o.name}]`));
  return [`${prefix}${command.prefix ?? command.name}`, ...parts].join(" ");
}

function buildPrefixArgs(
  tokens: string[],
  command: CommandDefinition,
  usage: string,
  t: TFunction,
): Record<string, unknown> {
  const options = command.options;
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
      throw new CommandError(t("errors.missingArg", { name: opt.name, usage }));
    }
    switch (opt.type) {
      case ApplicationCommandOptionType.String:
        args[opt.name] = token;
        break;
      case ApplicationCommandOptionType.Integer: {
        if (token === null) {
          args[opt.name] = null;
          break;
        }
        const n = parseInt(token, 10);
        if (Number.isNaN(n)) throw new CommandError(t("errors.invalidNumber", { name: opt.name }));
        args[opt.name] = n;
        break;
      }
      case ApplicationCommandOptionType.Boolean:
        args[opt.name] = token !== null ? token === "true" : null;
        break;
      case ApplicationCommandOptionType.Number: {
        if (token === null) {
          args[opt.name] = null;
          break;
        }
        const n = parseFloat(token);
        if (Number.isNaN(n)) throw new CommandError(t("errors.invalidNumber", { name: opt.name }));
        args[opt.name] = n;
        break;
      }
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
    respond: async (content) => {
      const payload = typeof content === "string" ? { content } : content;
      if (interaction.replied) {
        return interaction.followUp(payload as InteractionReplyOptions);
      }
      if (interaction.deferred) {
        return interaction.editReply(payload as InteractionEditReplyOptions);
      }
      return interaction
        .reply({ ...(payload as InteractionReplyOptions), withResponse: true })
        .then((res) => res.resource?.message as Message);
    },
  };
}

function buildPrefixContext(
  bot: BotContext,
  message: Message,
  tokens: string[],
  command: CommandDefinition,
  locale: Locale,
  prefix: string,
): CommandExecutionContext {
  const t = bot.i18n.bind(locale);
  return {
    bot,
    commandName: command.name,
    args: buildPrefixArgs(tokens, command, formatUsage(prefix, command), t) as never,
    raw: tokens,
    interaction: null,
    message,
    source: message.guildId ? "guild" : "dm",
    locale,
    t,
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
    respond: (content) => {
      const payload = typeof content === "string" ? { content } : content;
      const { content: text, embeds, components, files } = payload as MessageReplyOptions;
      return message.reply({ content: text, embeds, components, files });
    },
  };
}
