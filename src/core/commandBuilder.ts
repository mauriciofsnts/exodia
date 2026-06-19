import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  Message,
  MessageComponentInteraction,
  MessageReaction,
  MessageReplyOptions,
  PermissionsBitField,
  TextBasedChannel,
  User,
  VoiceBasedChannel,
} from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";
import type { Locale, TFunction } from "@/i18n/index";
import type { BotContext } from "./context";

// Supported option types (excludes subcommands/groups)
export type SimpleOptionType =
  | ApplicationCommandOptionType.String
  | ApplicationCommandOptionType.Integer
  | ApplicationCommandOptionType.Boolean
  | ApplicationCommandOptionType.Number;

export interface OptionChoice<V extends string | number = string | number> {
  name: string;
  value: V;
}

export interface OptionDef<
  N extends string = string,
  T extends SimpleOptionType = SimpleOptionType,
  R extends boolean = boolean,
> {
  name: N;
  description: string;
  type: T;
  required?: R;
  choices?: ReadonlyArray<OptionChoice>;
  // Slash-only: suggest values live as the user types. Mutually exclusive with
  // `choices`. Ignored for prefix commands.
  autocomplete?: AutocompleteHandler;
}

export interface AutocompleteContext {
  bot: BotContext;
  interaction: AutocompleteInteraction;
  value: string; // current text in the focused option
  guildId: string | null;
  locale: Locale;
  t: TFunction;
}

export type AutocompleteHandler = (
  ctx: AutocompleteContext,
) => Promise<OptionChoice[]> | OptionChoice[];

type OptionTypeMap = {
  [ApplicationCommandOptionType.String]: string;
  [ApplicationCommandOptionType.Integer]: number;
  [ApplicationCommandOptionType.Boolean]: boolean;
  [ApplicationCommandOptionType.Number]: number;
};

// When choices are present, infer the union of their value literals
type ResolveChoiceValues<O extends OptionDef> = O extends {
  choices: ReadonlyArray<OptionChoice<infer V>>;
}
  ? V
  : never;

// If the option has choices → use the choice value union; otherwise fall back to the type map
// O extends { required: true } checks the concrete value, avoiding boolean widening
type ResolveOptionType<O extends OptionDef> = [ResolveChoiceValues<O>] extends [never]
  ? O extends { required: true }
    ? OptionTypeMap[O["type"]]
    : OptionTypeMap[O["type"]] | null
  : O extends { required: true }
    ? ResolveChoiceValues<O>
    : ResolveChoiceValues<O> | null;

// Maps each option's name to its resolved TypeScript type
export type TypedArgs<Options extends OptionDef[]> = {
  readonly [O in Options[number] as O["name"]]: ResolveOptionType<O>;
};

export interface CommandExecutionContext<TOptions extends OptionDef[] = []> {
  bot: BotContext;
  commandName: string; // canonical name (matches the definition), regardless of invocation style
  args: TypedArgs<TOptions>;
  raw: string[]; // unparsed tokens — prefix commands only
  reply(content: string | InteractionReplyOptions | MessageReplyOptions): Promise<void>;
  // Buys time for slow work (>3s) before replying. Slash: defers the interaction;
  // prefix: shows a typing indicator. A later reply() fills/edits the response.
  defer(ephemeral?: boolean): Promise<void>;
  // Like reply(), but returns the created Message so the caller can attach
  // reactions or react to component clicks on it. Slash: edits the deferred
  // reply (or replies); prefix: replies to the invoking message.
  respond(content: string | InteractionReplyOptions | MessageReplyOptions): Promise<Message>;
  interaction: ChatInputCommandInteraction | null;
  message: Message | null;
  source: "guild" | "dm";
  locale: Locale;
  t: TFunction;
  guildId: string | null;
  channelId: string;
  userId: string;
  displayName: string;
  memberPermissions: Readonly<PermissionsBitField> | null;
  voiceChannel: VoiceBasedChannel | null;
  textChannel: TextBasedChannel | null; // where the command was invoked — for out-of-band messages
}

export type ExecuteHandler<TOptions extends OptionDef[] = []> = (
  ctx: CommandExecutionContext<TOptions>,
) => Promise<void>;

export type Next = () => Promise<void>;
// biome-ignore lint/suspicious/noExplicitAny: intentional type erasure — middleware must accept any command's context
export type Middleware = (ctx: CommandExecutionContext<any>, next: Next) => Promise<void>;

// --- Message components (buttons / select menus) ---

export interface ComponentExecutionContext {
  bot: BotContext;
  interaction: MessageComponentInteraction;
  customId: string;
  args: string[]; // customId segments after the routing prefix (split on ":")
  guildId: string | null;
  userId: string;
  locale: Locale;
  t: TFunction;
}

export type ComponentHandler = (ctx: ComponentExecutionContext) => Promise<void>;

export interface ComponentHandlerDef {
  prefix: string; // matches the customId up to its first ":"
  handle: ComponentHandler;
}

// --- Emoji reactions ---

export interface ReactionExecutionContext {
  bot: BotContext;
  reaction: MessageReaction; // always resolved — partials are fetched before dispatch
  user: User; // always resolved, never a bot
  emoji: string; // unicode emoji or custom emoji name
  event: "add" | "remove";
}

export type ReactionHandler = (ctx: ReactionExecutionContext) => Promise<void>;

export interface ReactionHandlerDef {
  // When set, the dispatcher invokes this handler only for these emojis — and,
  // crucially, skips fetching partial reactions/users entirely when no handler
  // matches the reacted emoji. Omit to receive every reaction (handler
  // self-filters). The emoji is read off the (already-resolved) reaction emoji,
  // so the filter costs nothing and avoids an API round trip per stray reaction.
  emojis?: readonly string[];
  handle: ReactionHandler;
}

export interface CommandDefinition {
  name: string;
  description: string;
  prefix: string | null;
  options: OptionDef[];
  middlewares: Middleware[];
  components: ComponentHandlerDef[];
  reactions: ReactionHandlerDef[];
  // biome-ignore lint/suspicious/noExplicitAny: type-erased at definition boundary — concrete type lives in CommandBuilder<TOptions>
  execute: ExecuteHandler<any>;
}

export function composeMiddlewares(
  middlewares: Middleware[],
  // biome-ignore lint/suspicious/noExplicitAny: pipeline operates on type-erased handlers
  handler: ExecuteHandler<any>,
  // biome-ignore lint/suspicious/noExplicitAny: <same>
): ExecuteHandler<any> {
  return (ctx) => {
    const dispatch = (i: number): Promise<void> => {
      if (i < middlewares.length) return middlewares[i](ctx, () => dispatch(i + 1));
      return handler(ctx);
    };
    return dispatch(0);
  };
}

export class CommandBuilder<TOptions extends OptionDef[] = []> {
  private _name = "";
  private _description = "";
  private _prefix: string | null = null;
  private _options: OptionDef[] = [];
  private _middlewares: Middleware[] = [];
  private _components: ComponentHandlerDef[] = [];
  private _reactions: ReactionHandlerDef[] = [];
  // biome-ignore lint/suspicious/noExplicitAny: concrete type carried by TOptions, erased here for storage
  private _execute: ExecuteHandler<any> = async () => {};

  setName(name: string): this {
    this._name = name;
    return this;
  }

  setDescription(description: string): this {
    this._description = description;
    return this;
  }

  setPrefix(prefix: string): this {
    this._prefix = prefix;
    return this;
  }

  // `const O` forces TypeScript to infer literal types (e.g. required: true, choice values)
  addOption<const O extends OptionDef>(option: O): CommandBuilder<[...TOptions, O]> {
    this._options.push(option as OptionDef);
    return this as unknown as CommandBuilder<[...TOptions, O]>;
  }

  use(middleware: Middleware): this {
    this._middlewares.push(middleware);
    return this;
  }

  // Routes component interactions (buttons/selects) whose customId starts with
  // `prefix:` to this handler. The command that renders the component owns it.
  onComponent(prefix: string, handle: ComponentHandler): this {
    this._components.push({ prefix, handle });
    return this;
  }

  // Registers a reaction handler. Reactions fire on existing messages, so the
  // handler self-filters (e.g. by looking the message up); it isn't scoped to a
  // single invocation.
  // `emojis` (optional) lets the dispatcher skip irrelevant reactions before
  // resolving partials — pass the set this handler reacts to (e.g. vote emojis).
  onReaction(handler: ReactionHandler, emojis?: readonly string[]): this {
    this._reactions.push({ handle: handler, emojis });
    return this;
  }

  execute(handler: ExecuteHandler<TOptions>): this {
    this._execute = handler;
    return this;
  }

  build(): CommandDefinition {
    if (!this._name) throw new Error("Command must have a name");
    if (!this._description) throw new Error("Command must have a description");

    return {
      name: this._name,
      description: this._description,
      prefix: this._prefix,
      options: this._options,
      middlewares: this._middlewares,
      components: this._components,
      reactions: this._reactions,
      execute: this._execute,
    };
  }
}

export function createCommand(): CommandBuilder {
  return new CommandBuilder();
}
