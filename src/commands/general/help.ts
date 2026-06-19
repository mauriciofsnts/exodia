import { ApplicationCommandOptionType, type EmbedBuilder } from "discord.js";
import { type CommandDefinition, createCommand } from "@/core/commandBuilder";
import type { TFunction } from "@/i18n/index";
import { embed } from "@/lib/embeds";

const TYPE_LABELS: Partial<Record<ApplicationCommandOptionType, string>> = {
  [ApplicationCommandOptionType.String]: "text",
  [ApplicationCommandOptionType.Integer]: "integer",
  [ApplicationCommandOptionType.Boolean]: "boolean",
  [ApplicationCommandOptionType.Number]: "number",
};

// How the command is invoked: prefix form when it has one, else slash.
function invocation(cmd: CommandDefinition, prefix: string): string {
  return cmd.prefix ? `${prefix}${cmd.prefix}` : `/${cmd.name}`;
}

function commandList(commands: CommandDefinition[], prefix: string, t: TFunction): EmbedBuilder {
  const lines = [...commands]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => `\`${invocation(c, prefix)}\` — ${c.description}`);

  return embed()
    .setTitle(t("commands.help.title"))
    .setDescription(`${t("commands.help.hint", { prefix })}\n\n${lines.join("\n")}`);
}

function commandDetail(cmd: CommandDefinition, prefix: string, t: TFunction): EmbedBuilder {
  const optsUsage = cmd.options.map((o) => (o.required ? `<${o.name}>` : `[${o.name}]`)).join(" ");
  const usage = `${invocation(cmd, prefix)}${optsUsage ? ` ${optsUsage}` : ""}`;

  const card = embed()
    .setTitle(cmd.name)
    .setDescription(cmd.description)
    .addFields({ name: t("commands.help.usage"), value: `\`${usage}\`` });

  if (cmd.options.length > 0) {
    const optionLines = cmd.options
      .map((o) => {
        const kind = TYPE_LABELS[o.type] ?? "value";
        const req = o.required ? t("commands.help.required") : t("commands.help.optional");
        return `• \`${o.name}\` (${kind}, ${req}) — ${o.description}`;
      })
      .join("\n");
    card.addFields({ name: t("commands.help.options"), value: optionLines });
  } else {
    card.addFields({ name: t("commands.help.options"), value: t("commands.help.noOptions") });
  }

  return card;
}

export default createCommand()
  .setName("help")
  .setDescription("List all commands, or show details for one")
  .setPrefix("help")
  .addOption({
    name: "command",
    description: "Command to show details for",
    type: ApplicationCommandOptionType.String,
    required: false,
    autocomplete: ({ bot, value }) => {
      const q = value.trim().toLowerCase();
      return [...bot.commands]
        .filter(
          (c) =>
            !q ||
            c.name.toLowerCase().includes(q) ||
            (c.prefix?.toLowerCase().includes(q) ?? false),
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 25)
        .map((c) => ({ name: `${c.name} — ${c.description}`.slice(0, 100), value: c.name }));
    },
  })
  .execute(async ({ bot, args, reply, t }) => {
    const prefix = bot.config.PREFIX;

    if (args.command) {
      const query = args.command.toLowerCase();
      const cmd = bot.commands.find(
        (c) => c.name.toLowerCase() === query || c.prefix?.toLowerCase() === query,
      );

      if (!cmd) {
        await reply(t("commands.help.notFound", { command: args.command, prefix }));
        return;
      }

      await reply({ embeds: [commandDetail(cmd, prefix, t)] });
      return;
    }

    await reply({ embeds: [commandList(bot.commands, prefix, t)] });
  })
  .build();
