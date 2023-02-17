import {
  AudioResource,
  createAudioResource,
  StreamType,
} from '@discordjs/voice'
import play from 'play-dl'
import { Track } from 'types/track'
import youtube from 'youtube-sr'
import { getInfo } from 'ytdl-core'

export class Song {
  public readonly url: string
  public readonly title: string
  public readonly duration: number
  public readonly thumbnail: string

  public constructor({ url, title, duration, thumbnail }: Track) {
    this.url = url
    this.title = title
    this.duration = duration
    this.thumbnail = thumbnail
  }

  public static async from(search: string = '') {
    const isYoutubeUrl =
      /^(https?:\/\/)?(www\.)?(m\.)?(youtube\.com|youtu\.?be)\/.+$/gi.test(
        search
      )

    let songInfo

    if (isYoutubeUrl) {
      songInfo = await getInfo(search)

      return new this({
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
        duration: parseInt(songInfo.videoDetails.lengthSeconds),
        thumbnail: songInfo.thumbnail_url,
        streaming: 'youtube',
      })
    } else {
      const result = await youtube.searchOne(search)

      songInfo = await getInfo(`https://youtube.com/watch?v=${result.id}`)

      return new this({
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
        duration: parseInt(songInfo.videoDetails.lengthSeconds),
        thumbnail: result.thumbnail?.url ?? '',
        streaming: 'youtube',
      })
    }
  }

  public async makeResource(): Promise<AudioResource<Song> | void> {
    let stream

    stream = await (
      await play.stream(this.url, { discordPlayerCompatibility: true })
    ).stream

    if (!stream) throw new Error('Failed to get resource')

    return createAudioResource(stream, {
      metadata: this,
      inlineVolume: true,
      inputType: StreamType.Arbitrary,
    })
  }
}
