import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { getCommitHash } from "@/lib/version";
import { notifyAdmin } from "@/middlewares/adminErrorNotifier";
import { EventScheduler } from "@/services/events/eventScheduler";
import { onboardGuild } from "@/services/guild/onboarding";
import type { Middleware } from "./commandBuilder";
import { CommandLoader } from "./commandLoader";
import { ensureGuildCommandsSynced, recordGlobalCommandCount } from "./commandSync/sync";
import type { BotContext } from "./context";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export class Bot {
  private client: Client;
  private loader = new CommandLoader();
  private scheduler: EventScheduler | null = null;

  constructor(
    private ctx: Omit<BotContext, "client" | "commands">,
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
    // Load first so the command list is complete before it's exposed on the context.
    await this.loader.load(resolve(__dirname, "../commands"));

    const ctx: BotContext = { ...this.ctx, client: this.client, commands: this.loader.all };

    // Source of truth every guild's synced command count is compared against.
    recordGlobalCommandCount(ctx).catch((err) =>
      ctx.logger.error({ err }, "Failed to record global command count"),
    );

    // Bind Lavalink (via Shoukaku) to the gateway before login so the connector
    // catches the voice state/server updates produced during login.
    ctx.player.connect(this.client);

    // Detached playback errors (Lavalink node / track exceptions) fire outside any
    // command, so route them to the admin notifier explicitly.
    ctx.player.setErrorReporter((err, report) => {
      notifyAdmin(ctx, err, {
        label: `player:${report.stage}`,
        source: "playback",
        guildId: report.guildId,
        extra: report.url ? { url: report.url } : undefined,
      }).catch((e) => ctx.logger.error({ err: e }, "Failed to notify admin of player error"));
    });

    this.loader.registerInteractionHandler(this.client, ctx);
    this.loader.registerPrefixHandler(this.client, ctx);
    this.loader.registerReactionHandler(this.client, ctx);

    this.client.once("ready", (c) => {
      ctx.logger.info({ commit: getCommitHash() }, `Bot online: ${c.user.tag}`);

      // Fetch and log the admin user configured via ADMIN_USER_ID in .env.
      const adminId = ctx.config.ADMIN_USER_ID;
      if (adminId) {
        c.users
          .fetch(adminId)
          .then((admin) => {
            ctx.logger.info({ id: admin.id, tag: admin.tag }, "Admin user loaded");
          })
          .catch((err) => {
            ctx.logger.error({ err, adminId }, "Failed to fetch admin user");
          });
      } else {
        ctx.logger.warn("ADMIN_USER_ID not set — skipping admin user fetch");
      }

      // Start polling guild_events once guilds are cached (no-op without a db).
      this.scheduler = new EventScheduler(ctx);
      this.scheduler.start();

      // Catch up guilds that already finished setup but fell behind on synced
      // commands (e.g. a command was added after they ran setup). Guilds that
      // haven't finished setup get synced when their wizard completes instead.
      void syncConfiguredGuilds(c, ctx);
    });

    // Onboard each newly joined guild: create a config channel and post the guide.
    this.client.on("guildCreate", (guild) => {
      onboardGuild(guild, ctx).catch((err) => {
        ctx.logger.error({ err, guildId: guild.id }, "Guild onboarding failed");
      });
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

      this.scheduler?.stop();
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

// Sequential on purpose: a guild.commands.set() call per already-configured
// guild, run once at startup — no need to race Discord's rate limits for a
// background catch-up sync.
async function syncConfiguredGuilds(client: Client, ctx: BotContext): Promise<void> {
  if (!ctx.commandSync) return;

  for (const guild of client.guilds.cache.values()) {
    try {
      const cfg = await ctx.guildConfig.get(guild.id);
      if (!cfg.configured) continue;
      await ensureGuildCommandsSynced(guild, ctx);
    } catch (err) {
      ctx.logger.error({ err, guildId: guild.id }, "Guild command sync catch-up failed");
    }
  }
}
