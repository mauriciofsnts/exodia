import { createCommand } from "@/core/commandBuilder.js";

export default createCommand()
  .setName("ping")
  .setDescription("Check bot latency")
  .setPrefix("ping")
  .execute(async ({ bot, reply, t }) => {
    await reply(t("commands.ping.response", { latency: bot.client.ws.ping }));
  })
  .build();
