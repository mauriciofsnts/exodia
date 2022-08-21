import {
  AudioResource,
  createAudioResource,
  StreamType,
} from '@discordjs/voice'
import ytdl from 'ytdl-core'
import play from 'play-dl'
import * as yt from 'youtube-search-without-api-key'

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

  public constructor({ url, title, duration }: Track) {
    this.url = url
    this.title = title
    this.duration = duration
  }

  public static async from(search: string = '') {
    let song: Track
    let songInfo = null

    if (
      search.match(
        /^(https?:\/\/)?(www\.)?(m\.)?(youtube\.com|youtu\.?be)\/.+$/gi
      )
    ) {
      songInfo = await play.video_info(search)

      if (!songInfo) {
        throw new Error('Looks like i was unable to find the song on YouTube')
      }

      song = {
        title: songInfo.video_details.title ?? '',
        url: songInfo.video_details.url,
        duration: songInfo.video_details.durationInSec,
      }
    } else {
      const searched = await yt.search(search)

      if (!searched) {
        throw new Error('Looks like i was unable to find the song on YouTube')
      }

      songInfo = searched[0]

      song = {
        title: songInfo.title,
        url: songInfo.url,
        duration: songInfo.duration_raw.toString(),
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