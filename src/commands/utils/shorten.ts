import { createHash } from "node:crypto";
import { ApplicationCommandOptionType } from "discord.js";
import { createCommand } from "@/core/commandBuilder.js";
import { CommandError } from "@/lib/errors.js";
import { cached } from "@/services/cache/cached.js";
import { createShortener } from "@/services/shortener/index.js";

const CACHE_TTL = 3600; // 1 hour — a long→short mapping is stable

export default createCommand()
  .setName("shorten")
  .setDescription("Shorten a URL")
  .setPrefix("shorten")
  .addOption({
    name: "url",
    description: "URL to shorten",
    type: ApplicationCommandOptionType.String,
    required: true,
  })
  .execute(async ({ bot, args, reply, defer, t }) => {
    if (!/^https?:\/\//i.test(args.url)) throw new CommandError(t("commands.shorten.invalid"));

    await defer();

    const key = `cache:shorten:${createHash("sha1").update(args.url).digest("hex")}`;
    const short = await cached(bot.cache, key, CACHE_TTL, () =>
      createShortener(bot.config).shorten(args.url),
    ).catch(() => {
      throw new CommandError(t("commands.shorten.failed"));
    });

    await reply(t("commands.shorten.result", { url: short }));
  })
  .build();
