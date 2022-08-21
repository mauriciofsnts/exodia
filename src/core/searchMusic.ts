import ytdl from 'ytdl-core'
import scdl from 'soundcloud-downloader'

export type Track = {
    id: string
    title: string
    url: string
    img?: string
    duration: number | string
    ago: Date | string
    views?: string
    strategy: 'youtube' | 'soundcloud' | 'default'
}

const yts = require('yt-search')

async function GetBestResult(searchQuery: string): Promise<Track> {
    let song: Track
    let songInfo = null

    if (
        searchQuery.match(
            /^(https?:\/\/)?(www\.)?(m\.)?(youtube\.com|youtu\.?be)\/.+$/gi
        )
    ) {
        songInfo = await ytdl.getInfo(searchQuery)

        if (!songInfo) {
            throw new Error('Looks like i was unable to find the song on YouTube')
        }

        song = {
            id: songInfo.videoDetails.videoId,
            title: songInfo.videoDetails.title,
            url: songInfo.videoDetails.video_url,
            img: songInfo.player_response.videoDetails.thumbnail.thumbnails[0].url,
            duration: songInfo.videoDetails.lengthSeconds,
            ago: songInfo.videoDetails.publishDate,
            views: String(songInfo.videoDetails.viewCount).padStart(10, ' '),
            strategy: 'youtube'
        }
    } else if (searchQuery.match(/^https?:\/\/(soundcloud\.com)\/(.*)$/gi)) {
        songInfo = await scdl.getInfo(searchQuery)

        if (!songInfo) {
            throw new Error('Looks like i was unable to find the song on soundcloud')
        }

        if (!songInfo?.permalink_url)
            throw new Error('Cannot find url for this music')

        song = {
            id: songInfo.permalink ?? '',
            title: songInfo.title ?? '',
            url: songInfo.permalink_url ?? '',
            img: songInfo.artwork_url,
            ago: songInfo.last_modified ?? '',
            views: String(songInfo.playback_count).padStart(10, ' '),
            duration:
                songInfo && songInfo.duration ? Math.ceil(songInfo.duration / 1000) : 0,
            strategy: 'soundcloud'
        }
    } else {
        const searched = await yts.search(searchQuery)

        if (!searched) {
            throw new Error('Looks like i was unable to find the song on YouTube')
        }

        songInfo = searched.videos[0]

        song = {
            id: songInfo.videoId,
            title: songInfo.title,
            views: String(songInfo.views).padStart(10, ' '),
            url: songInfo.url,
            ago: songInfo.ago,
            duration: songInfo.duration.toString(),
            img: songInfo.image,
            strategy: 'default'
        }
    }

    return song
}

export default GetBestResult
