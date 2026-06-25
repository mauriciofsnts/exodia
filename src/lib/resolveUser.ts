import type { Client, User } from "discord.js";

// Resolves a user from a slash/prefix String argument: a mention (<@123>),
// a raw snowflake, or null/empty. The builder has no native User option type,
// so commands take the target as a string and resolve it here. Returns null when
// the input has no snowflake or the user can't be fetched.
export async function resolveUser(client: Client, input: string | null): Promise<User | null> {
  if (!input) return null;
  const id = input.match(/\d{17,20}/)?.[0];
  if (!id) return null;
  try {
    return await client.users.fetch(id);
  } catch {
    return null;
  }
}
