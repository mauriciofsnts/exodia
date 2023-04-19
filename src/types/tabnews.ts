export type TabNewsArticle = {
  id: string
  owner_id: string
  parent_id: null
  slug: string
  title: string
  status: string
  source_url: null
  created_at: Date
  updated_at: Date
  published_at: Date
  deleted_at: null
  tabcoins: string
  owner_username: String
  children_deep_count: number
}

export interface ITabNews {
  news: TabNewsArticle[]

  // eslint-disable-next-line no-unused-vars
  get(index: number): TabNewsArticle

  getAll(): TabNewsArticle[]
}
