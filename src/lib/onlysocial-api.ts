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
   * Upload media from URL - OnlySocial scarica il file dall'URL fornito
   */
  private async uploadMediaFromUrl(videoUrl: string, altText?: string): Promise<unknown> {
    console.log(`  � Sending video URL to OnlySocial: ${videoUrl.substring(0, 80)}...`)
    
    try {
      // Invia semplicemente l'URL - OnlySocial scaricherà il video da solo
      const result = await this.makeRequest('/media/', 'POST', {
        file: videoUrl,
        alt_text: altText || 'Video from scheduler'
      })
      
      const data = result as { id?: number; uuid?: string }
      console.log(`  ✓ Media uploaded, ID: ${data.id || 'N/A'}`)
      
      return { data: result }
    } catch (error) {
      console.error('  ✗ Error uploading media URL:', error)
      throw error
    }
  }

  /**
   * ✅ METODO CORRETTO: Upload media scaricando da DigitalOcean e inviando con FormData
   * Questo metodo risolve il problema del trailing slash e usa multipart/form-data
   * 
   * @param digitalOceanUrl - URL pubblico del video su DigitalOcean Spaces
   * @param videoName - Nome del file video (es. "video.mp4")
   * @param altText - Testo alternativo opzionale
   * @returns Oggetto con id, uuid, url del media caricato su OnlySocial
   */
  async uploadMediaFromDigitalOcean(
    digitalOceanUrl: string,
    videoName: string,
    altText?: string
  ): Promise<{
    id: number
    uuid: string
    url: string
    thumb_url?: string
    name: string
    mime_type: string
    type: string
    is_video: boolean
  }> {
    console.log('📥 Downloading video from DigitalOcean...')
    console.log(`   URL: ${digitalOceanUrl.substring(0, 80)}...`)
    
    try {
      // Step 1: Scarica il video da DigitalOcean
      const videoResponse = await fetch(digitalOceanUrl)
      
      if (!videoResponse.ok) {
        throw new Error(`Failed to download from DigitalOcean: ${videoResponse.status} ${videoResponse.statusText}`)
      }
      
      // Step 2: Converti la risposta in Blob
      const videoBlob = await videoResponse.blob()
      const videoSizeMB = (videoBlob.size / 1024 / 1024).toFixed(2)
      console.log(`📦 Video downloaded: ${videoSizeMB} MB`)
      
      // Step 3: Crea FormData per multipart/form-data
      const formData = new FormData()
      formData.append('file', videoBlob, videoName)
      formData.append('alt_text', altText || videoName)
      
      // ⚠️ IMPORTANTE: URL SENZA trailing slash!
      const apiUrl = `${this.baseUrl}/${this.config.workspaceUuid}/media`
      
      console.log('🚀 Uploading to OnlySocial...')
      console.log(`   Endpoint: ${apiUrl}`)
      
      // Step 4: Invia a OnlySocial con FormData
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Accept': 'application/json'
          // ⚠️ NON includere 'Content-Type' - FormData lo gestisce automaticamente
        },
        body: formData
      })
      
      // Step 5: Gestisci la risposta
      const responseText = await response.text()
      
      // OnlySocial risponde con 200 o 201 in caso di successo
      if (response.status === 200 || response.status === 201) {
        const data = JSON.parse(responseText)
        console.log('✅ Video uploaded successfully to OnlySocial!')
        console.log(`   Media ID: ${data.id}`)
        console.log(`   Media URL: ${data.url}`)
        if (data.thumb_url) {
          console.log(`   Thumbnail: ${data.thumb_url}`)
        }
        
        return {
          id: data.id,
          uuid: data.uuid,
          url: data.url,
          thumb_url: data.thumb_url,
          name: data.name,
          mime_type: data.mime_type,
          type: data.type,
          is_video: data.is_video
        }
      } else {
        // Errore da OnlySocial
        console.error('❌ OnlySocial API Error:', response.status, responseText)
        throw new Error(`OnlySocial API Error: ${response.status} - ${responseText}`)
      }
      
    } catch (error) {
      console.error('❌ Error in uploadMediaFromDigitalOcean:', error)
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
   * ✅ METODO OTTIMIZZATO: Crea post con media IDs già caricati
   * Usa questo metodo quando hai già caricato i media con uploadMediaFromDigitalOcean
   * 
   * @param accountUuid - UUID dell'account social
   * @param caption - Testo del post
   * @param mediaIds - Array di ID dei media già caricati su OnlySocial
   * @param scheduleDate - Data nel formato YYYY-MM-DD (opzionale)
   * @param scheduleTime - Ora nel formato HH:MM (opzionale)
   * @param postType - Tipo di post (reel, story, post)
   * @returns Oggetto con UUID del post creato
   */
  async createPostWithMediaIds(
    accountUuid: string,
    caption: string,
    mediaIds: number[],
    scheduleDate?: string,
    scheduleTime?: string,
    postType?: string
  ): Promise<{ postUuid: string; post: unknown }> {
    console.log(`📝 Creating post with ${mediaIds.length} media IDs: ${mediaIds.join(', ')}`)
    
    // 1. Prepara i dati del post
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

    // 2. Ottieni l'account per avere l'ID numerico
    const account = await this.getAccount(accountUuid) as { id: number }
    
    postData.accounts = [account.id]
    postData.versions[0].account_id = account.id

    // 3. Crea il post
    console.log('📤 Sending post to OnlySocial API...')
    const result = await this.createPost(postData) as { data?: { uuid: string } }
    
    console.log('✅ Post created successfully!')
    console.log(`   Post UUID: ${result.data?.uuid || 'N/A'}`)
    
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

