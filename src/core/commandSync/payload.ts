import type { ApplicationCommandDataResolvable } from "discord.js";
import type { CommandDefinition } from "@/core/commandBuilder";

// The subset of commands that register as Discord slash commands. Commands that
// opted out via `.setSlash(false)` are prefix-only and excluded everywhere slash
// registration happens (deploy script, runtime sync, and the synced count).
export function slashCommands(commands: CommandDefinition[]): CommandDefinition[] {
  return commands.filter((cmd) => cmd.slash);
}

// Shared between the deploy script (global/dev-guild REST PUT) and the runtime
// command-sync service (per-guild `guild.commands.set`) so both register the
// exact same command shape.
export function buildCommandPayloads(
  commands: CommandDefinition[],
): ApplicationCommandDataResolvable[] {
  return slashCommands(commands).map((cmd) => ({
    name: cmd.name,
    description: cmd.description,
    options: cmd.options.map((opt) => ({
      name: opt.name,
      description: opt.description,
      type: opt.type,
      required: opt.required ?? false,
      // autocomplete and choices are mutually exclusive on Discord's side.
      ...(opt.autocomplete ? { autocomplete: true } : opt.choices ? { choices: opt.choices } : {}),
    })),
  })) as ApplicationCommandDataResolvable[];
}
