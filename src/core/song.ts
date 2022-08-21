import {
  AudioResource,
  createAudioResource,
  StreamType,
} from '@discordjs/voice'
import ytdl from 'ytdl-core'

const yts = require('yt-search')

export interface Track {
  url: string
  title: string
  duration: number
  streaming?: 'youtube' | 'soundcloud' | 'search'
}

export class Song {
  public readonly url: string
  public readonly title: string
  public readonly duration: number

  private readonly streaming?: string

  public constructor({ url, title, duration, streaming }: Track) {
    this.url = url
    this.title = title
    this.duration = duration
    this.streaming = streaming ?? 'search'
  }

  public static async from(search: string = '') {
    let song: Track
    let songInfo = null

    if (
      search.match(
        /^(https?:\/\/)?(www\.)?(m\.)?(youtube\.com|youtu\.?be)\/.+$/gi
      )
    ) {
      songInfo = await ytdl.getInfo(search)

      if (!songInfo) {
        throw new Error('Looks like i was unable to find the song on YouTube')
      }

      song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
        duration: parseInt(songInfo.videoDetails.lengthSeconds),
        streaming: 'youtube',
      }
    } else {
      const searched = await yts.search(search)

      if (!searched) {
        throw new Error('Looks like i was unable to find the song on YouTube')
      }

      songInfo = searched.videos[0]

      song = {
        title: songInfo.title,
        url: songInfo.url,
        duration: songInfo.duration.toString(),
        streaming: 'search',
      }
    }

    return new this({
      duration: song.duration,
      title: song.title,
      url: song.url,
      streaming: song.streaming,
    })
  }

  public async makeResource(): Promise<AudioResource<Song> | void> {
    let stream

    if (this.streaming === 'youtube') {
      stream = await ytdl(this.url, {
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
      })
    } else {
      stream = await ytdl(this.url, { filter: 'audioonly' })
    }

    if (!stream) throw new Error('Failed to get resource')

    return createAudioResource(stream, {
      metadata: this,
      inlineVolume: true,
      inputType: StreamType.Arbitrary,
    })
  }
}
