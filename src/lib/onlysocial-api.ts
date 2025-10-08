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
  file: string // URL del file
  alt_text?: string
}

interface PostContent {
  body: string
  media: string[] // Array di URL dei media
  url?: string
}

interface PostVersion {
  account_id: number
  is_original: boolean
  content: PostContent[]
  options: Record<string, unknown>
}

interface CreatePostData {
  accounts: number[]
  versions: PostVersion[]
  tags: string[]
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
    body?: unknown
  ): Promise<unknown> {
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
  async listAccounts(): Promise<unknown> {
    return this.makeRequest('/accounts')
  }

  /**
   * Get a specific account
   */
  async getAccount(accountUuid: string): Promise<unknown> {
    return this.makeRequest(`/accounts/${accountUuid}`)
  }

  // ==================== MEDIA FILES ====================

  /**
   * List media files with pagination
   */
  async listMedia(page: number = 1): Promise<unknown> {
    return this.makeRequest(`/media?page=${page}`)
  }

  /**
   * Get a specific media file
   */
  async getMedia(mediaUuid: string): Promise<unknown> {
    return this.makeRequest(`/media/${mediaUuid}`)
  }

  /**
   * Upload a media file
   * Se mediaData.file è un URL, scarica il file e caricalo come binario
   */
  async uploadMedia(mediaData: MediaFile): Promise<unknown> {
    // Se file è un URL, scaricalo prima e caricalo come binario
    if (typeof mediaData.file === 'string' && mediaData.file.startsWith('http')) {
      return this.uploadMediaFromUrl(mediaData.file, mediaData.alt_text)
    }
    
    // Altrimenti usa il metodo standard JSON
    return this.makeRequest('/media/', 'POST', mediaData)
  }

  /**
   * Download video from URL and upload to OnlySocial as binary
   */
  private async uploadMediaFromUrl(videoUrl: string, altText?: string): Promise<unknown> {
    const url = `${this.baseUrl}/${this.config.workspaceUuid}/media/`
    
    console.log(`  📥 Downloading video from: ${videoUrl.substring(0, 80)}...`)
    
    try {
      // 1. Scarica il video da DigitalOcean
      const videoResponse = await fetch(videoUrl)
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.status} ${videoResponse.statusText}`)
      }
      
      const videoBlob = await videoResponse.blob()
      console.log(`  ✓ Downloaded ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`)
      
      // 2. Crea FormData per upload multipart/form-data
      const formData = new FormData()
      formData.append('file', videoBlob, 'video.mp4')
      if (altText) {
        formData.append('alt_text', altText)
      }
      
      // 3. Upload a OnlySocial come file binario
      console.log(`  📤 Uploading binary to OnlySocial...`)
      const uploadResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          // NON impostare Content-Type manualmente - FormData lo fa automaticamente con boundary
        },
        body: formData,
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        throw new Error(`OnlySocial upload failed: ${uploadResponse.status} - ${errorText}`)
      }

      const result = await uploadResponse.json()
      console.log(`  ✓ Upload successful, media ID: ${result.id}`)
      
      // Restituisci nel formato atteso
      return { data: result }
    } catch (error) {
      console.error('  ✗ Error in uploadMediaFromUrl:', error)
      throw error
    }
  }

  /**
   * Delete media files (multiple items)
   */
  async deleteMedia(itemIds: number[]): Promise<unknown> {
    const itemsParam = itemIds.join(',')
    return this.makeRequest(`/media?items=${itemsParam}`, 'DELETE')
  }

  // ==================== POSTS ====================

  /**
   * List posts with pagination
   */
  async listPosts(page: number = 1): Promise<unknown> {
    return this.makeRequest(`/posts?page=${page}`)
  }

  /**
   * Get a specific post
   */
  async getPost(postUuid: string): Promise<unknown> {
    return this.makeRequest(`/posts/${postUuid}`)
  }

  /**
   * Create a new post
   */
  async createPost(postData: CreatePostData): Promise<unknown> {
    return this.makeRequest('/posts', 'POST', postData)
  }

  /**
   * Delete a single post
   */
  async deletePost(postUuid: string, trash: boolean = false): Promise<unknown> {
    return this.makeRequest(`/posts/${postUuid}`, 'DELETE', { trash })
  }

  /**
   * Delete multiple posts
   */
  async deletePosts(postUuids: string[], trash: boolean = false): Promise<unknown> {
    return this.makeRequest('/posts', 'DELETE', { posts: postUuids, trash })
  }

  /**
   * Schedule a post for publishing
   */
  async schedulePost(postUuid: string, scheduleData: SchedulePostData): Promise<unknown> {
    return this.makeRequest(`/posts/schedule/${postUuid}`, 'POST', scheduleData)
  }

  // ==================== HELPER METHODS ====================

  /**
   * Build post options based on post type
   */
  private buildPostOptions(postType?: string): Record<string, unknown> {
    const options: Record<string, unknown> = {}
    
    if (postType) {
      // Instagram
      options.instagram = {
        type: postType, // "reel", "story", or "post"
        collaborators: []
      }
      options.instagram_direct = {
        type: postType,
        collaborators: []
      }
      // Facebook
      options.facebook_page = {
        type: postType
      }
      // TikTok
      options.tiktok = {
        privacy_level: {},
        allow_comments: {},
        allow_duet: {},
        allow_stitch: {},
        content_disclosure: {},
        brand_organic_toggle: {},
        brand_content_toggle: {}
      }
    }
    
    return options
  }

  /**
   * Helper method to create a post with video/media
   * NUOVO APPROCCIO: Crea il post direttamente senza upload preliminare
   * OnlySocial scaricherà i video dagli URL forniti in background
   */
  async createMediaPost(
    accountUuid: string,
    caption: string,
    mediaUrls: string[],
    scheduleDate?: string,
    scheduleTime?: string,
    postType?: string
  ): Promise<{ postUuid: string; post: unknown }> {
    console.log(`📤 Uploading ${mediaUrls.length} media files to OnlySocial...`)
    
    // 1. Carica i media su OnlySocial (scarica da DigitalOcean e invia come binario)
    const mediaIds: number[] = []
    
    for (const mediaUrl of mediaUrls) {
      try {
        console.log(`  Uploading: ${mediaUrl.substring(0, 80)}...`)
        const uploadResult = await this.uploadMedia({ file: mediaUrl }) as { data?: { id: number } }
        
        if (uploadResult.data?.id) {
          mediaIds.push(uploadResult.data.id)
          console.log(`  ✓ Media uploaded with ID: ${uploadResult.data.id}`)
        } else {
          console.error(`  ✗ Upload failed, no ID returned:`, uploadResult)
          throw new Error(`Failed to upload media: ${mediaUrl}`)
        }
      } catch (error) {
        console.error(`  ✗ Error uploading media ${mediaUrl}:`, error)
        throw error
      }
    }

    console.log(`✓ All media uploaded. IDs: ${mediaIds.join(', ')}`)

    // 2. Crea il post con gli ID dei media
    const postData: CreatePostData = {
      accounts: [], // Verrà popolato con l'ID numerico dell'account
      versions: [
        {
          account_id: 0, // Placeholder, verrà sostituito
          is_original: true,
          content: [
            {
              body: caption,
              media: mediaIds.map(id => String(id)), // Converti gli ID in stringhe
              url: ""
            }
          ],
          options: this.buildPostOptions(postType)
        }
      ],
      tags: [],
      date: scheduleDate || null,
      time: scheduleTime || "12:00",
      until_date: null,
      until_time: "",
      repeat_frequency: null,
      short_link_provider: null,
      short_link_provider_id: null
    }

    // 3. Ottieni l'account per avere l'ID numerico
    const account = await this.getAccount(accountUuid) as { id: number }
    
    postData.accounts = [account.id]
    postData.versions[0].account_id = account.id

    // 4. Crea il post
    const result = await this.createPost(postData) as { data?: { uuid: string } }
    
    return {
      postUuid: result.data?.uuid || '',
      post: result
    }
  }

  /**
   * Helper method to schedule a post at specific date/time
   */
  async schedulePostAt(
    postUuid: string,
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number
  ): Promise<unknown> {
    // Formatta data e ora per OnlySocial API
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    
    // Per schedulare ad una data specifica, usiamo postNow: false
    // e aggiorniamo il post con la data corretta
    return this.makeRequest(`/posts/schedule/${postUuid}`, 'POST', {
      postNow: false,
      scheduled_at: `${date} ${time}:00`
    })
  }

  /**
   * Helper method completo per creare e schedulare un post
   */
  async createAndSchedulePost(
    accountUuid: string,
    caption: string,
    mediaUrls: string[],
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    postType?: string
  ): Promise<{ success: boolean; postUuid: string; scheduledAt: string }> {
    try {
      // Crea il post
      const { postUuid } = await this.createMediaPost(
        accountUuid,
        caption,
        mediaUrls,
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        postType
      )

      // Schedula il post
      await this.schedulePostAt(postUuid, year, month, day, hour, minute)

      const scheduledAt = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`

      return {
        success: true,
        postUuid,
        scheduledAt
      }
    } catch (error) {
      console.error('Error creating and scheduling post:', error)
      throw error
    }
  }

  /**
   * Helper method to publish a post immediately
   */
  async publishPostNow(postUuid: string): Promise<unknown> {
    return this.schedulePost(postUuid, { postNow: true })
  }

  /**
   * Helper method to get posts published in the last hour
   */
  async getRecentlyPublishedPosts(): Promise<unknown[]> {
    const posts = await this.listPosts() as { data?: unknown[] }
    
    // Nota: questa è una implementazione semplificata
    // In realtà dovremmo filtrare i post in base al loro status e data di pubblicazione
    return posts.data || []
  }

  /**
   * Helper method to get posts scheduled for next 2 hours
   */
  async getUpcomingPosts(): Promise<unknown[]> {
    const posts = await this.listPosts() as { data?: unknown[] }
    
    // Nota: questa è una implementazione semplificata
    // In realtà dovremmo filtrare i post in base al loro status e data programmata
    return posts.data || []
  }
}

