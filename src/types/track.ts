export interface Track {
  url: string
  title: string
  duration: number
  thumbnail: string
  streaming?: 'youtube' | 'soundcloud' | 'search'
}
