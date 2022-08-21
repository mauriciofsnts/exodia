import {
    createAudioPlayer,
    createAudioResource,
    joinVoiceChannel,
    StreamType,
} from '@discordjs/voice'
import { ApplicationCommandOptionType, InteractionType } from 'discord.js'
import scdl from 'soundcloud-downloader'
import { client } from '../..'
import { Command } from '../../core/command'
import GetBestResult, { Track } from '../../core/searchMusic'
import { Embed, Reply } from '../reply'

const ytdl = require('ytdl-core')

export default new Command({
    name: 'play',
    description: 'play a song',
    options: [
        {
            name: 'songtitle',
            description: 'title of the song',
            type: ApplicationCommandOptionType.String,
            required: true,
        },
    ],
    run: async ({ interaction, args, type }) => {
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
                    description:
                        'You need it is on a server to execute this command',
                    type: 'error',
                }),
                interaction,
                type
            )

        const songTitle =
            interaction.type === InteractionType.ApplicationCommand
                ? String(interaction.options.get('songtitle')?.value)
                : Array.isArray(args) && args.join(' ')

        if (!songTitle)
            return Reply(
                Embed({
                    title: 'Error',
                    description: 'You need to inform the song title',
                    type: 'error',
                }),
                interaction,
                type
            )

        let song: Track

        try {
            song = await GetBestResult(songTitle)
        } catch (error) {
            return Reply(
                Embed({
                    title: 'Error',
                    description: 'Looks like i was unable to find the song',
                    type: 'error',
                }),
                interaction,
                type
            )
        }

        const serverQueue = client.queue.get(interaction.guildId)

        if (serverQueue) {
            serverQueue.songs.push(song)

            Reply(
                Embed({
                    title: `Ok`,
                    description: `${song.title} adicionado a playlist`,
                    type: 'success',
                }),
                interaction,
                type
            )

            return
        }

        const queueConstruct = {
            textChannel: interaction.channelId,
            voiceChannel: interaction.member.voice.channel.id,
            connection: null,
            songs: [] as Track[],
            volume: 80,
            playing: true,
            loop: false,
        }


        queueConstruct.songs.push(song)
        client.queue.set(interaction.guildId, queueConstruct)

        async function play(song: Track): Promise<void> {
            const queue = client.queue.get(interaction.guildId)

            try {
                if (!interaction.member.voice.channel) return
                if (!interaction.guild) return

                const connection = joinVoiceChannel({
                    channelId: interaction.member.voice.channel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                })

                let stream

                if (song.strategy === 'soundcloud') {
                    stream = await scdl.downloadFormat(song.url, scdl.FORMATS.OPUS)
                } else if (song.strategy === 'youtube') {
                    stream = await ytdl(song.url, {
                        quality: 'highestaudio',
                        highWaterMark: 1 << 25,
                        type: 'opus',
                    })
                } else {
                    stream = await ytdl(song.url, { filter: 'audioonly' })
                }

                if (!stream) return

                const resource = createAudioResource(stream, {
                    inputType: StreamType.Arbitrary,
                })

                const player = createAudioPlayer()
                player.play(resource)

                connection.subscribe(player)


                player.addListener("stateChange", (oldOne, newOne) => {
                    if (newOne.status == "idle") {
                        const queue = client.queue.get(interaction.guildId)
                        queue.songs.shift()
                        if (queue.songs.length > 0) {
                            play(queue.songs[1])
                        }
                    }
                });


                Reply(
                    Embed({
                        title: `Ok`,
                        description: `Tocando agora ${song.title}`,
                        type: 'success',
                    }),
                    interaction,
                    type
                )
            } catch (error) {
                console.error('Error on playing: ', error)

                if (queue) {
                    queue.songs.shift()

                    play(queue.songs[0])
                }
            }
        }

        try {
            play(queueConstruct.songs[0])

        } catch (error) {
            Reply(
                Embed({
                    title: `Error`,
                    description: `something is wrong`,
                    type: 'success',
                }),
                interaction,
                type
            )
        }
    },
})
