import youtube, { Playlist as YoutubePlaylist } from 'youtube-sr'
import { Song } from './Song'
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

  public static async from(query: string = '') {
    const urlValid = pattern.test(query)
    let playlist

    if (urlValid) {
      playlist = await youtube.getPlaylist(query)
    } else {
      const result = await youtube.searchOne(query, 'playlist')
      playlist = await youtube.getPlaylist(result.url!)
    }

    return new this(playlist)
  }
}
