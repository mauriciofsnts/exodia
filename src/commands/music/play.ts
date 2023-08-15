import { replyLocalizedEmbed } from 'commands/reply';
import { Command } from 'core/command';
import {
	ApplicationCommandOptionType,
	GuildTextBasedChannel,
} from 'discord.js';
import { client } from 'index';
import { ENVS, loadEnv } from 'utils/envHelper';
import getArgs from 'utils/getArgs';
import { i18n } from 'utils/i18n';
import { isOnServer, isOnVoiceChannel } from 'validations/channel';

const prefix = loadEnv(ENVS.PREFIX);

export default new Command({
	name: 'play',
	description: i18n.__('play.description'),
	categorie: '🎧 Audio',
	aliases: ['play', 'p'],
	validations: [isOnVoiceChannel, isOnServer],
	options: [
		{
			name: 'song',
			description: i18n.__mf('play.usageReply', { prefix }),
			type: ApplicationCommandOptionType.String,
			required: true,
		},
	],
	run: async ({ interaction, args, type }) => {
		const songTitle = getArgs(interaction, args, 'song');

		if (!songTitle) {
			replyLocalizedEmbed(
				interaction,
				type,
				{ title: 'play.songNotFound', description: 'play.usageReply' },
				{ prefix: prefix },
			);

			return;
		}

		const voiceChannel = interaction.member.voice.channel;
		if (!voiceChannel || !interaction.channel) return;

		if (type === 'INTERACTION') {
			await interaction
				.followUp({
					content: i18n.__mf('play.loading'),
				})
				.then((msg) => {
					setTimeout(() => {
						msg.delete();
					}, 2000);
				});
		}

		client.distube.play(voiceChannel, songTitle, {
			textChannel: interaction.channel as GuildTextBasedChannel,
			member: interaction.member,
		});
	},
});
