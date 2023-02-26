import axios from 'axios'

export class UrlShortener {
  private readonly API_ENDPOINT: string = 'https://st.mrzt.dev/api/v2/links'

  async shorten(url: string): Promise<string> {
    return await axios
      .post(this.API_ENDPOINT, {
        target: url,
        showAdvanced: false,
      })
      .then((response) => {
        return response.data.link
      })
  }
}
