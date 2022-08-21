export interface Track {
    url: string
    title: string
    duration: number
    streaming?: 'youtube' | 'soundcloud' | 'search'
}