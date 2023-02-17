export interface Article {
  source: {
    id: string
    name: string
  }
  author: string | null
  title: string
  description: string
  url: string
  urlToImage: string
  publishedAt: Date
  content: string
}

export interface NewsApiResponse {
  status: string
  totalResults: number
  articles: Article[]
}

export interface INews {
  news: Article[]

  get(index: number): Article

  getAll(): Article[]
}
