import axios from 'axios'
import { Article, INews, NewsApiResponse } from 'types/news'
import { ENVS, loadEnv } from 'utils/envHelper'

const API_ENDPOINT =
  'https://newsapi.org/v2/top-headlines?country=br&apiKey=' +
  loadEnv(ENVS.NEWSAPI_API_KEY)

export class News implements INews {
  news: Article[]

  constructor(articles: Article[]) {
    this.news = articles
  }

  get(index: number): Article {
    const article = this.news[index]
    return article
  }

  getAll(): Article[] {
    return this.news
  }
}

export async function getNews(): Promise<News> {
  return new Promise<News>((resolve, reject) => {
    axios
      .get<NewsApiResponse>(API_ENDPOINT)
      .then((response) => {
        resolve(new News(response.data.articles))
      })
      .catch((error) => {
        reject(error)
      })
  })
}
