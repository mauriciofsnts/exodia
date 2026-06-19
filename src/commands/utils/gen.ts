import { ApplicationCommandOptionType } from "discord.js";
import { createCommand } from "@/core/commandBuilder.js";
import { embed } from "@/lib/embeds.js";
import { CommandError } from "@/lib/errors.js";
import {
  generateCard,
  generateCep,
  generateCnpj,
  generateCpf,
  generateRg,
} from "@/lib/fakeData.js";

const GENERATORS = new Map<string, () => string>([
  ["cpf", generateCpf],
  ["cnpj", generateCnpj],
  ["card", generateCard],
  ["rg", generateRg],
  ["cep", generateCep],
]);

export default createCommand()
  .setName("gen")
  .setDescription("Generate fake-but-valid test data (CPF, CNPJ, card, RG, CEP)")
  .setPrefix("gen")
  .addOption({
    name: "type",
    description: "What to generate",
    type: ApplicationCommandOptionType.String,
    required: true,
    choices: [
      { name: "cpf", value: "cpf" },
      { name: "cnpj", value: "cnpj" },
      { name: "card", value: "card" },
      { name: "rg", value: "rg" },
      { name: "cep", value: "cep" },
    ],
  })
  .execute(async ({ args, reply, t }) => {
    const generate = GENERATORS.get(args.type.toLowerCase());
    if (!generate) throw new CommandError(t("commands.gen.unknown"));

    const value = generate();
    const raw = value.replace(/\D/g, "");
    const card = embed()
      .setTitle(t("commands.gen.title", { type: args.type.toUpperCase() }))
      .addFields(
        { name: t("commands.gen.formatted"), value: `\`${value}\`` },
        { name: t("commands.gen.raw"), value: `\`${raw}\`` },
      );
    await reply({ embeds: [card] });
  })
  .build();
