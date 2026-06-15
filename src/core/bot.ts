import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import type { Middleware } from "./commandBuilder.js";
import { CommandLoader } from "./commandLoader.js";
import type { BotContext } from "./context.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export class Bot {
  private client: Client;
  private loader = new CommandLoader();

  constructor(
    private ctx: Omit<BotContext, "client">,
    middlewares: Middleware[] = [],
  ) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions, // vote reactions on the play card
        GatewayIntentBits.MessageContent, // privileged — enable in Discord dev portal
      ],
      // Reaction/User partials are required to receive events on uncached messages.
      partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
    });

    for (const mw of middlewares) this.loader.use(mw);
  }

  async start(): Promise<void> {
    const ctx: BotContext = { ...this.ctx, client: this.client };

    await this.loader.load(resolve(__dirname, "../commands"));

    this.loader.registerInteractionHandler(this.client, ctx);
    this.loader.registerPrefixHandler(this.client, ctx);
    this.loader.registerReactionHandler(this.client, ctx);

    this.client.once("ready", (c) => {
      ctx.logger.info(`Bot online: ${c.user.tag}`);
    });

    this.client.on("error", (err) => {
      ctx.logger.error({ err }, "Discord client error");
    });

    await this.client.login(ctx.config.DISCORD_TOKEN);

    this.registerShutdown(ctx);
  }

  private registerShutdown(ctx: BotContext): void {
    const shutdown = async (signal: string) => {
      ctx.logger.info(`${signal} received — shutting down`);

      ctx.player.destroyAll();
      this.client.destroy();
      ctx.cache.disconnect();

      if (ctx.db) await ctx.db.close();

      process.exit(0);
    };

    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));

    process.on("unhandledRejection", (reason) => {
      ctx.logger.error({ reason }, "Unhandled rejection");
    });

    process.on("uncaughtException", (err) => {
      ctx.logger.error({ err }, "Uncaught exception");
      shutdown("uncaughtException").catch(() => process.exit(1));
    });
  }
}
