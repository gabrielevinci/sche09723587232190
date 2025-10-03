/**
 * OnlySocial API Client
 * Wrapper per le API di OnlySocial con tutti i metodi necessari
 */

interface OnlySocialConfig {
  token: string
  workspaceUuid: string
  baseUrl?: string
}

interface MediaFile {
  file: string
  alt_text: string
}

interface PostContent {
  body: string
  media: any[]
  url: string
}

interface PostVersion {
  account_id: number
  is_original: boolean
  content: PostContent[]
  options: Record<string, any>
}

interface CreatePostData {
  accounts: any[]
  versions: PostVersion[]
  tags: any[]
  date: string | null
  time: string
  until_date: string | null
  until_time: string
  repeat_frequency: string | null
  short_link_provider: string | null
  short_link_provider_id: string | null
}

interface SchedulePostData {
  postNow: boolean
}

export class OnlySocialAPI {
  private config: OnlySocialConfig
  private baseUrl: string

  constructor(config: OnlySocialConfig) {
    this.config = config
    this.baseUrl = config.baseUrl || 'https://app.onlysocial.io/os/api'
  }

  private getHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.config.token}`,
      'Content-Type': 'application/json',
    }
  }

  private async makeRequest(
    endpoint: string, 
    method: string = 'GET', 
    body?: any
  ): Promise<any> {
    const url = `${this.baseUrl}/${this.config.workspaceUuid}${endpoint}`
    
    const options: RequestInit = {
      method,
      headers: this.getHeaders(),
      redirect: 'follow'
    }

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body)
    }

    try {
      const response = await fetch(url, options)
      const result = await response.text()
      
      if (!response.ok) {
        throw new Error(`OnlySocial API Error: ${response.status} - ${result}`)
      }
      
      return JSON.parse(result)
    } catch (error) {
      console.error('OnlySocial API request failed:', error)
      throw error
    }
  }

  // ==================== ACCOUNTS ====================

  /**
   * List all accounts in the workspace
   */
  async listAccounts(): Promise<any> {
    return this.makeRequest('/accounts')
  }

  /**
   * Get a specific account
   */
  async getAccount(accountUuid: string): Promise<any> {
    return this.makeRequest(`/accounts/${accountUuid}`)
  }

  // ==================== MEDIA FILES ====================

  /**
   * List media files with pagination
   */
  async listMedia(page: number = 1): Promise<any> {
    return this.makeRequest(`/media?page=${page}`)
  }

  /**
   * Get a specific media file
   */
  async getMedia(mediaUuid: string): Promise<any> {
    return this.makeRequest(`/media/${mediaUuid}`)
  }

  /**
   * Upload a media file
   */
  async uploadMedia(mediaData: MediaFile): Promise<any> {
    return this.makeRequest('/media/', 'POST', mediaData)
  }

  /**
   * Delete media files (multiple items)
   */
  async deleteMedia(itemIds: number[]): Promise<any> {
    const itemsParam = itemIds.join(',')
    return this.makeRequest(`/media?items=${itemsParam}`, 'DELETE')
  }

  // ==================== POSTS ====================

  /**
   * List posts with pagination
   */
  async listPosts(page: number = 1): Promise<any> {
    return this.makeRequest(`/posts?page=${page}`)
  }

  /**
   * Get a specific post
   */
  async getPost(postUuid: string): Promise<any> {
    return this.makeRequest(`/posts/${postUuid}`)
  }

  /**
   * Create a new post
   */
  async createPost(postData: CreatePostData): Promise<any> {
    return this.makeRequest('/posts', 'POST', postData)
  }

  /**
   * Delete a single post
   */
  async deletePost(postUuid: string, trash: boolean = false): Promise<any> {
    return this.makeRequest(`/posts/${postUuid}`, 'DELETE', { trash })
  }

  /**
   * Delete multiple posts
   */
  async deletePosts(postUuids: string[], trash: boolean = false): Promise<any> {
    return this.makeRequest('/posts', 'DELETE', { posts: postUuids, trash })
  }

  /**
   * Schedule a post for publishing
   */
  async schedulePost(postUuid: string, scheduleData: SchedulePostData): Promise<any> {
    return this.makeRequest(`/posts/schedule/${postUuid}`, 'POST', scheduleData)
  }

  // ==================== HELPER METHODS ====================

  /**
   * Helper method to create a simple text post
   */
  async createSimpleTextPost(
    accountIds: number[],
    content: string,
    scheduleDate?: string,
    scheduleTime?: string
  ): Promise<any> {
    const postData: CreatePostData = {
      accounts: accountIds,
      versions: [
        {
          account_id: accountIds[0] || 0,
          is_original: true,
          content: [
            {
              body: content,
              media: [],
              url: ""
            }
          ],
          options: {}
        }
      ],
      tags: [],
      date: scheduleDate || null,
      time: scheduleTime || "",
      until_date: null,
      until_time: "",
      repeat_frequency: null,
      short_link_provider: null,
      short_link_provider_id: null
    }

    return this.createPost(postData)
  }

  /**
   * Helper method to publish a post immediately
   */
  async publishPostNow(postUuid: string): Promise<any> {
    return this.schedulePost(postUuid, { postNow: true })
  }

  /**
   * Helper method to get posts published in the last hour
   */
  async getRecentlyPublishedPosts(): Promise<any[]> {
    const posts = await this.listPosts()
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    
    // Nota: questa è una implementazione semplificata
    // In realtà dovremmo filtrare i post in base al loro status e data di pubblicazione
    return posts.data || []
  }

  /**
   * Helper method to get posts scheduled for next 2 hours
   */
  async getUpcomingPosts(): Promise<any[]> {
    const posts = await this.listPosts()
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000)
    
    // Nota: questa è una implementazione semplificata
    // In realtà dovremmo filtrare i post in base al loro status e data programmata
    return posts.data || []
  }
}
