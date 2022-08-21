import { client } from '../..'
import { Command } from '../../core/command'
import Player from '../../core/Player'
import { Embed, Reply } from '../reply'
import { createAudioPlayer, createAudioResource, joinVoiceChannel, StreamType } from "@discordjs/voice";

const fs = require('fs');
const ytdl = require("ytdl-core");

export default new Command({
    name: 'join',
    description: 'just join the channel ',
    run: async ({ interaction, type }) => {


        if (!interaction.member.voice.channel) return;
        if (!interaction.guildId) return;
        if (!interaction.guild) return;

        const connection = joinVoiceChannel({ channelId: interaction.member.voice.channel.id, guildId: interaction.guild.id, adapterCreator: interaction.guild.voiceAdapterCreator });




        const stream = ytdl('http://www.youtube.com/watch?v=aqz-KE-bpKQ', { filter: 'audioonly' });

        const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
        const player = createAudioPlayer();


        player.play(resource);


        connection.subscribe(player)



        Reply(
            Embed({
                title: 'OK',
                description: "OK",
                type: 'success',
            }),
            interaction,
            type
        )

    },
})
