import type {
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  Message,
  MessageReplyOptions,
  PermissionsBitField,
  TextBasedChannel,
  VoiceBasedChannel,
} from "discord.js";
import { ApplicationCommandOptionType } from "discord.js";
import type { Locale, TFunction } from "@/i18n/index.js";
import type { BotContext } from "./context.js";

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
}

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

export interface CommandDefinition {
  name: string;
  description: string;
  prefix: string | null;
  options: OptionDef[];
  middlewares: Middleware[];
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
      execute: this._execute,
    };
  }
}

export function createCommand(): CommandBuilder {
  return new CommandBuilder();
}
