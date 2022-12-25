import youtube, { Playlist as YoutubePlaylist } from 'youtube-sr'
import { Song } from './song'

const pattern = /^.*(youtu.be\/|list=)([^#\&\?]*).*/i

export class Playlist {
  public data: YoutubePlaylist
  public videos: Song[]

  public constructor(playlist: YoutubePlaylist) {
    this.data = playlist

    this.videos = this.data.videos
      .filter(
        (video) =>
          video.title != 'Private video' && video.title != 'Deleted video'
      )
      .map((video) => {
        return new Song({
          title: video.title!,
          url: `https://youtube.com/watch?v=${video.id}`,
          duration: video.duration / 1000,
          thumbnail: '',
          streaming: 'youtube',
        })
      })
  }

  public static async from(url: string = '', search: string = '') {
    const urlValid = pattern.test(url)
    let playlist

    if (urlValid) {
      playlist = await youtube.getPlaylist(url)
    } else {
      const result = await youtube.searchOne(search, 'playlist')
      playlist = await youtube.getPlaylist(result.url!)
    }

    return new this(playlist)
  }
}
