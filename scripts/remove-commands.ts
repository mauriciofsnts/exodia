import { REST, Routes } from "discord.js";
import { config } from "@/config/index";

// Mirrors deploy-commands.ts's scope logic: PUTting an empty array wipes every
// command Discord has registered for that scope (guild or global) — handy
// when commands were renamed/removed and stale entries linger.
async function removeCommands() {
  const rest = new REST().setToken(config.DISCORD_TOKEN);

  if (config.DISCORD_GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
      {
        body: [],
      },
    );
    console.log(`Removed all commands from guild ${config.DISCORD_GUILD_ID}`);
  } else {
    await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body: [] });
    console.log("Removed all global commands (can take up to 1h to propagate)");
  }
}

removeCommands().catch((err) => {
  console.error("Remove failed:", err);
  process.exit(1);
});
