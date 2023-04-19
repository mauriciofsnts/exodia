import { DistubeEvents } from 'core/event';
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} from 'discord.js';
import { i18n } from 'utils/i18n';

export default new DistubeEvents('playSong', async (queue, song) => {
	const embed = new EmbedBuilder();

	embed.setTitle(i18n.__('play.nowplaying'));
	embed.setDescription(
		`**[${song.name}](${song.url})** \`[${song.formattedDuration}]\``,
	);
	embed.setColor(0x6875da);
	embed.setThumbnail(song.thumbnail ?? '');
	embed.setTimestamp();
	embed.setFooter({
		text: i18n.__mf('play.requestBy', { user: song.user?.tag }),
	});

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId('pause')
			.setEmoji('⏸️')
			.setStyle(ButtonStyle.Secondary),

		new ButtonBuilder()
			.setCustomId('next')
			.setEmoji('⏭️')
			.setStyle(ButtonStyle.Secondary),

		new ButtonBuilder()
			.setCustomId('stop')
			.setEmoji('⏹️')
			.setStyle(ButtonStyle.Secondary),
	);

	const msg = await queue.textChannel?.send({
		embeds: [embed],
		components: [row],
	});

	if (!msg) return;

	const collector = msg.createMessageComponentCollector({
		filter: (m) => ['stop', 'pause', 'next'].includes(m.customId),
		time: song.duration > 0 ? song.duration * 1000 : 300000,
	});

	collector.on('collect', async (collection) => {
		await collection.deferUpdate();

		switch (collection.customId) {
		case 'pause':
			if (queue.paused) {
				queue.resume();

				const updatedRow =
						new ActionRowBuilder<ButtonBuilder>().addComponents(
							new ButtonBuilder()
								.setCustomId('pause')
								.setEmoji('⏸️')
								.setStyle(ButtonStyle.Secondary),

							new ButtonBuilder()
								.setCustomId('next')
								.setEmoji('⏭️')
								.setStyle(ButtonStyle.Secondary),

							new ButtonBuilder()
								.setCustomId('stop')
								.setEmoji('⏹️')
								.setStyle(ButtonStyle.Secondary),
						);

				await collection.editReply({
					embeds: [embed],
					components: [updatedRow],
				});
			}
			else {
				queue.pause();

				const updatedRow =
						new ActionRowBuilder<ButtonBuilder>().addComponents(
							new ButtonBuilder()
								.setCustomId('pause')
								.setEmoji('▶️')
								.setStyle(ButtonStyle.Secondary),

							new ButtonBuilder()
								.setCustomId('next')
								.setEmoji('⏭️')
								.setStyle(ButtonStyle.Secondary),

							new ButtonBuilder()
								.setCustomId('stop')
								.setEmoji('⏹️')
								.setStyle(ButtonStyle.Secondary),
						);

				await collection.editReply({
					embeds: [embed],
					components: [updatedRow],
				});
			}
			break;

		case 'next':
			queue.skip();
			break;

		case 'stop':
			queue.stop();
			break;
		}
	});

	// delete msg after song duration
	setTimeout(() => {
		if (!msg) return;
		msg.delete();
	}, song.duration * 1000 ?? 5000);
});
