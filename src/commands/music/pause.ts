import { client } from '../..'
import { Command } from '../../core/command'
import { Embed, Reply } from '../reply'

export default new Command({
    name: 'pause',
    description: 'Pause the music',
    run: async ({ interaction, type }) => {
        if (!interaction.member.voice.channel)
            return Reply(
                Embed({
                    title: 'Error',
                    description: 'You need it is on a voice channel',
                    type: 'error',
                }),
                interaction,
                type
            )

        if (!interaction.guild)
            return Reply(
                Embed({
                    title: 'Error',
                    description: 'You need it is on a server to execute this command',
                    type: 'error',
                }),
                interaction,
                type
            )

        const queue = client.queues.get(interaction.guild.id)

        if (!queue)
            return Reply(
                Embed({
                    title: 'Error',
                    description: 'There is nothing playing that I could skip for you',
                    type: 'error',
                }),
                interaction,
                type
            )

        const paused = queue.player.pause()

        if (paused) {
            return Reply(
                Embed({
                    title: 'Ok',
                    description: 'Pausing',
                    type: 'success',
                }),
                interaction,
                type
            )
        }

        return Reply(
            Embed({
                title: 'Error',
                description: 'Something is wrong',
                type: 'error',
            }),
            interaction,
            type
        )
    },
})
