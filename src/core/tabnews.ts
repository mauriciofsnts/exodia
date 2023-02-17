import axios from 'axios'
import { ITabNews, TabNewsArticle } from 'types/tabnews'

const API_ENDPOINT =
  'https://www.tabnews.com.br/api/v1/contents?page=1&per_page=15&strategy=relevant'

export const getNews = async () => {
  const response = await axios.get(API_ENDPOINT)
  return response.data
}

export class TabNews implements ITabNews {
  news: TabNewsArticle[]

  constructor(news: any[]) {
    this.news = news
  }

  get(index: number): TabNewsArticle {
    const article = this.news[index]
    return article
  }

  getAll(): TabNewsArticle[] {
    return this.news
  }
}

export async function getTabNews(): Promise<TabNews> {
  return new Promise<TabNews>((resolve, reject) => {
    axios
      .get<TabNewsArticle[]>(API_ENDPOINT)
      .then((response) => {
        resolve(new TabNews(response.data))
      })
      .catch((error) => {
        reject(error)
      })
  })
}
