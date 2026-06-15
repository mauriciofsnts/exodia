import { randomInt } from "node:crypto";
import { ApplicationCommandOptionType } from "discord.js";
import { createCommand } from "@/core/commandBuilder.js";
import { cooldown } from "@/middlewares/cooldown.js";

const MIN_LENGTH = 8;
const MAX_LENGTH = 128;
const DEFAULT_LENGTH = 16;
const TTL_SECONDS = 120; // how long the DM survives before the bot deletes it

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function pick(charset: string): string {
  return charset[randomInt(charset.length)];
}

// Cryptographically random password with at least one char from each class.
function generatePassword(length: number): string {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  for (let i = chars.length; i < length; i++) chars.push(pick(ALL));
  // Fisher-Yates shuffle so the guaranteed chars aren't always up front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export default createCommand()
  .setName("password")
  .setDescription("Generate a secure password and receive it in your DMs")
  .setPrefix("password")
  .addOption({
    name: "length",
    description: `Password length (${MIN_LENGTH}-${MAX_LENGTH}, default ${DEFAULT_LENGTH})`,
    type: ApplicationCommandOptionType.Integer,
    required: false,
  })
  .use(cooldown(5))
  .execute(async ({ args, reply, defer, interaction, message, t }) => {
    const length = Math.min(Math.max(args.length ?? DEFAULT_LENGTH, MIN_LENGTH), MAX_LENGTH);
    const password = generatePassword(length);

    // Ephemeral on slash; the channel ack never contains the secret either way.
    await defer(true);

    const user = interaction?.user ?? message?.author;
    if (!user) return;

    try {
      const dm = await user.send(
        t("commands.password.dmContent", { password, seconds: TTL_SECONDS }),
      );
      // Best-effort TTL: delete the DM after the window (won't survive a restart).
      setTimeout(() => {
        dm.delete().catch(() => {});
      }, TTL_SECONDS * 1000);
      await reply(t("commands.password.sentToDm"));
    } catch {
      // Most likely the user has DMs closed (DiscordAPIError 50007).
      await reply(t("commands.password.dmFailed"));
    }
  })
  .build();
