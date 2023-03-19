import { Embed, Reply } from 'commands/reply'
import { Command } from 'core/command'
import { i18n } from 'utils/i18n'
import { hasQueue } from 'validations/audio'
import { isOnVoiceChannel, isOnServer } from 'validations/channel'

export default new Command({
  name: 'queue',
  description: i18n.__('queue.description'),
  categorie: '🎧 Audio',
  aliases: ['queue'],
  validations: [isOnVoiceChannel, isOnServer, hasQueue],
  run: async ({ interaction, type, commandParams }) => {
    const { queue, member } = commandParams

    const q = queue.songs
      .map(
        (song, i) =>
          `${i === 0 ? 'Playing:' : `${i}.`} ${song.name} - \`${
            song.formattedDuration
          }\``
      )
      .join('\n')

    const tracks = queue.songs.map(
      (song, i) => `**${i + 1}** - [${song.name}](${song.url}) | ${
        song.formattedDuration
      } 
      Requested by : ${song.user}`
    )

    const songs = queue.songs.length
    const nextSongs = `Coming next (**${songs}**)`

    Reply(
      Embed({
        type: 'success',
        description: `${tracks.slice(0, 10).join('\n')}\n\n${nextSongs}`,
      })
        .addFields({
          name: 'Now playing',
          value: `[${queue.songs[0].name}](${queue.songs[0].url}) - ${queue.songs[0].formattedDuration} | Requested by: ${queue.songs[0].user}`,
          inline: false,
        })
        .addFields({
          name: 'Will play',
          value: queue.formattedDuration,
          inline: true,
        })
        .addFields({
          name: 'Total songs:',
          value: `${songs}`,
          inline: true,
        }),
      interaction,
      type
    )
  },
})
