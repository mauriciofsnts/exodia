import { createHash } from "node:crypto";
import type { ApplicationCommandDataResolvable } from "discord.js";
import type { CommandDefinition } from "@/core/commandBuilder";

// The subset of commands that register as Discord slash commands. Commands that
// opted out via `.setSlash(false)` are prefix-only and excluded everywhere slash
// registration happens (deploy script, runtime sync, and the synced count).
export function slashCommands(commands: CommandDefinition[]): CommandDefinition[] {
  return commands.filter((cmd) => cmd.slash);
}

// Shared between the deploy script (global/dev-guild REST PUT) and the runtime
// command-sync service (per-guild diff) so both register the exact same shape.
export function buildCommandPayloads(
  commands: CommandDefinition[],
): ApplicationCommandDataResolvable[] {
  return slashCommands(commands).map(buildCommandPayload);
}

function buildCommandPayload(cmd: CommandDefinition): ApplicationCommandDataResolvable {
  return {
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
  } as ApplicationCommandDataResolvable;
}

// A command's desired shape plus a content hash of it. The hash lets the sync
// service tell, per command, whether the registered version is stale — so it
// can update only what changed instead of re-registering the whole set.
export interface DesiredCommand {
  name: string;
  payload: ApplicationCommandDataResolvable;
  signature: string;
}

export function buildDesiredCommands(commands: CommandDefinition[]): DesiredCommand[] {
  return slashCommands(commands).map((cmd) => {
    const payload = buildCommandPayload(cmd);
    return { name: cmd.name, payload, signature: signatureOf(payload) };
  });
}

// Deterministic content hash of a command payload. JSON.stringify is stable here
// because buildCommandPayload always emits keys in the same order, and option
// order is itself significant to Discord — so equal shapes hash equal.
function signatureOf(payload: ApplicationCommandDataResolvable): string {
  return createHash("sha1").update(JSON.stringify(payload)).digest("hex");
}

export function signaturesEqual(a: Map<string, string>, b: Map<string, string>): boolean {
  if (a.size !== b.size) return false;
  for (const [name, sig] of b) {
    if (a.get(name) !== sig) return false;
  }
  return true;
}
