import { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from "discord.js";
import { createCommand } from "@/core/commandBuilder";
import { renderFreeGamesList } from "@/services/freegames/freeGameCard";
import { handleFreeGamesComponent } from "@/services/freegames/freeGamesWizard";
import { fetchAllFreeGames } from "@/services/freegames/index";

export default createCommand()
  .setName("freegames")
  .setDescription("Current free games (Epic, Steam, GOG…) and giveaway alerts setup")
  .setPrefix("freegames")
  .onComponent("freegames", handleFreeGamesComponent)
  // Deliberately public: no guildOnly and no permission middleware — anyone can
  // list the current freebies, even in DMs and without a database. Only the
  // setup entry below is gated.
  .execute(async ({ bot, guildId, memberPermissions, reply, defer, t }) => {
    await defer();

    const games = await fetchAllFreeGames(bot.cache, bot.logger);
    if (games.length === 0) {
      await reply(t("commands.freegames.empty"));
      return;
    }

    // Alert setup needs a guild, Manage Server, and persistence for the
    // posted-tracking — hide the button otherwise. The component handler
    // re-checks permissions against forged clicks.
    const canConfigure =
      guildId !== null &&
      bot.freeGames !== null &&
      memberPermissions?.has(PermissionFlagsBits.ManageGuild);

    const components = canConfigure
      ? [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId("freegames:setup")
              .setLabel(t("commands.freegames.wizard.configure"))
              .setStyle(ButtonStyle.Secondary),
          ),
        ]
      : [];

    await reply({ embeds: [renderFreeGamesList(games, t)], components });
  })
  .build();
