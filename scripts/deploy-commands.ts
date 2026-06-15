import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { REST, Routes } from "discord.js";
import { config } from "@/config/index.js";
import type { CommandDefinition } from "@/core/commandBuilder.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

async function collectCommands(): Promise<CommandDefinition[]> {
  const commandsDir = resolve(__dirname, "../src/commands");
  const files = collectFiles(commandsDir);
  const commands: CommandDefinition[] = [];

  for (const file of files) {
    const mod = await import(pathToFileURL(file).href);
    const definition: CommandDefinition | undefined = mod.default ?? mod.command;
    if (definition?.name) commands.push(definition);
  }

  return commands;
}

function collectFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...collectFiles(full));
    else if (entry.endsWith(".ts") || entry.endsWith(".js")) files.push(full);
  }
  return files;
}

async function deploy() {
  const commands = await collectCommands();
  const rest = new REST().setToken(config.DISCORD_TOKEN);

  const body = commands.map((cmd) => ({
    name: cmd.name,
    description: cmd.description,
    options: cmd.options.map((opt) => ({
      name: opt.name,
      description: opt.description,
      type: opt.type,
      required: opt.required ?? false,
      ...(opt.choices ? { choices: opt.choices } : {}),
    })),
  }));

  if (config.DISCORD_GUILD_ID) {
    // dev: deploy to a single guild (instant)
    await rest.put(
      Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
      { body },
    );
    console.log(`Deployed ${body.length} commands to guild ${config.DISCORD_GUILD_ID}`);
  } else {
    // prod: deploy globally (up to 1h propagation)
    await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body });
    console.log(`Deployed ${body.length} commands globally`);
  }
}

deploy().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
