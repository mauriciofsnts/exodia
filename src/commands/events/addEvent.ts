import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { createCommand } from "@/core/commandBuilder.js";
import { CommandError } from "@/lib/errors.js";
import { guildOnly } from "@/middlewares/guildOnly.js";
import { requirePermission } from "@/middlewares/requirePermission.js";

export default createCommand()
  .setName("addevent")
  .setDescription("Schedule an event for this server")
  .setPrefix("addevent")
  .addOption({
    name: "start",
    description: "Start time, e.g. 2026-06-20T18:00",
    type: ApplicationCommandOptionType.String,
    required: true,
  })
  .addOption({
    name: "name",
    description: "Event name",
    type: ApplicationCommandOptionType.String,
    required: true,
  })
  .use(guildOnly)
  .use(requirePermission(PermissionFlagsBits.ManageEvents))
  .execute(async ({ bot, args, guildId, reply, t }) => {
    if (!guildId) throw new CommandError(t("errors.guildOnly"));
    if (!bot.events) throw new CommandError(t("errors.dbRequired"));

    const startAt = new Date(args.start);
    if (Number.isNaN(startAt.getTime())) throw new CommandError(t("events.invalidDate"));
    if (startAt.getTime() <= Date.now()) throw new CommandError(t("events.pastDate"));

    await bot.events.create(guildId, args.name, startAt);

    const when = `<t:${Math.floor(startAt.getTime() / 1000)}:F>`;
    await reply(t("events.added", { name: args.name, when }));
  })
  .build();
