import { createCommand } from "@/core/commandBuilder";
import { embed } from "@/lib/embeds";
import { getCommitHash } from "@/lib/version";

// Render process uptime (seconds) as a compact "1d 2h 3m" string. Minutes are
// always shown so a freshly-started bot still reads as "0m" rather than empty.
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

export default createCommand()
  .setName("ping")
  .setDescription("Check bot latency and status")
  .setPrefix("ping")
  .execute(async ({ bot, reply, t }) => {
    const dbLabel = bot.db ? t("commands.ping.dbPostgres") : t("commands.ping.dbNone");
    const audioLabel = bot.config.AUDIO_PROVIDER === "lavalink" ? "Lavalink" : "ytdl";

    const card = embed()
      .setTitle(t("commands.ping.title"))
      .addFields(
        {
          name: t("commands.ping.latency"),
          value: `${bot.client.ws.ping}ms`,
          inline: true,
        },
        { name: t("commands.ping.database"), value: dbLabel, inline: true },
        { name: t("commands.ping.audio"), value: audioLabel, inline: true },
        { name: t("commands.ping.commit"), value: `\`${getCommitHash()}\``, inline: true },
        {
          name: t("commands.ping.uptime"),
          value: formatUptime(process.uptime()),
          inline: true,
        },
      );

    await reply({ embeds: [card] });
  })
  .build();
