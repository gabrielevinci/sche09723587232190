/**
 * Video Flow Service
 * Gestisce il flusso dei video tra DigitalOcean Spaces e OnlySocial
 * Mantiene i 20GB di OnlySocial ottimizzati per i video delle prossime 6 ore
 */

import { OnlySocialAPI } from './onlysocial-api'
import { DOSpacesAPI } from './digitalocean-spaces'

interface VideoFlowConfig {
  onlySocial: {
    token: string
    workspaceUuid: string
  }
  digitalOcean: {
    endpoint: string
    region: string
    accessKeyId: string
    secretAccessKey: string
    bucket: string
  }
}

interface VideoFile {
  id: string
  filename: string
  size: number
  uploadedAt: Date
  scheduledFor?: Date
  onlySocialMediaId?: string
  digitalOceanKey: string
  status: 'pending' | 'uploaded_to_onlysocial' | 'scheduled' | 'published' | 'cleaned'
}

export class VideoFlowService {
  private onlySocialAPI: OnlySocialAPI
  private doSpacesAPI: DOSpacesAPI

  constructor(config: VideoFlowConfig) {
    this.onlySocialAPI = new OnlySocialAPI({
      token: config.onlySocial.token,
      workspaceUuid: config.onlySocial.workspaceUuid
    })

    this.doSpacesAPI = new DOSpacesAPI({
      endpoint: config.digitalOcean.endpoint,
      region: config.digitalOcean.region,
      accessKeyId: config.digitalOcean.accessKeyId,
      secretAccessKey: config.digitalOcean.secretAccessKey,
      bucket: config.digitalOcean.bucket
    })
  }

  /**
   * Pulisce i video da OnlySocial che sono stati pubblicati da più di 1 ora
   */
  async cleanupPublishedVideos(): Promise<{ deleted: number; freedSpace: number }> {
    try {
      console.log('🧹 Avvio pulizia video pubblicati da OnlySocial...')
      
      // 1. Ottieni i post pubblicati di recente
      const posts = await this.onlySocialAPI.listPosts() as { data?: Array<{ status: string; published_at: string; media?: Array<{ id: number; size?: number }> }> }
      
      let deletedCount = 0
      let freedSpace = 0

      // 2. Per ogni post, controlla se è stato pubblicato da più di 1 ora
      for (const post of posts.data || []) {
        // Nota: dovremmo controllare lo status e la data di pubblicazione effettiva
        // Questa è una implementazione semplificata
        
        if (post.status === 'published' && new Date(post.published_at) < new Date(Date.now() - 60 * 60 * 1000)) {
          // 3. Elimina i media associati da OnlySocial
          if (post.media && post.media.length > 0) {
            for (const media of post.media) {
              try {
                await this.onlySocialAPI.deleteMedia([media.id])
                freedSpace += media.size || 0
                deletedCount++
                console.log(`✅ Eliminato media ${media.id} da OnlySocial`)
              } catch (error) {
                console.error(`❌ Errore eliminazione media ${media.id}:`, error)
              }
            }
          }
        }
      }

      console.log(`🎉 Pulizia completata: ${deletedCount} file eliminati, ${(freedSpace / 1024 / 1024).toFixed(2)} MB liberati`)
      
      return {
        deleted: deletedCount,
        freedSpace: freedSpace
      }
    } catch (error) {
      console.error('❌ Errore durante la pulizia:', error)
      throw error
    }
  }

  /**
   * Carica su OnlySocial i video programmati per le prossime 2 ore
   */
  async uploadUpcomingVideos(): Promise<{ uploaded: number; totalSize: number }> {
    try {
      console.log('📤 Avvio caricamento video per le prossime 2 ore...')
      
      let uploadedCount = 0
      let totalSize = 0

      // 1. Trova i video programmati per le prossime 2 ore che non sono ancora su OnlySocial
      // Nota: qui dovresti interrogare il tuo database per i video programmati
      
      const upcomingVideos = await this.getUpcomingScheduledVideos()
      
      for (const video of upcomingVideos) {
        try {
          // 2. Scarica il video da DigitalOcean Spaces
          const videoData = await this.downloadVideoFromDO(video.digitalOceanKey)
          
          // 3. Carica su OnlySocial
          const uploadResult = await this.onlySocialAPI.uploadMedia({
            file: videoData.toString('base64'), // OnlySocial potrebbe richiedere base64
            alt_text: video.filename
          }) as { id: string }

          // 4. Aggiorna il record nel database
          await this.updateVideoStatus(video.id, 'uploaded_to_onlysocial', uploadResult.id)
          
          uploadedCount++
          totalSize += video.size
          
          console.log(`✅ Caricato video ${video.filename} su OnlySocial`)
        } catch (error) {
          console.error(`❌ Errore caricamento video ${video.filename}:`, error)
        }
      }

      console.log(`🎉 Caricamento completato: ${uploadedCount} video caricati, ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
      
      return {
        uploaded: uploadedCount,
        totalSize: totalSize
      }
    } catch (error) {
      console.error('❌ Errore durante il caricamento:', error)
      throw error
    }
  }

  /**
   * Gestisce l'intero flusso di ottimizzazione dello spazio OnlySocial
   */
  async optimizeOnlySocialStorage(): Promise<{
    cleanup: { deleted: number; freedSpace: number }
    upload: { uploaded: number; totalSize: number }
    remainingSpace: number
  }> {
    console.log('🔄 Avvio ottimizzazione spazio OnlySocial...')
    
    // 1. Prima pulisci i vecchi video
    const cleanupResult = await this.cleanupPublishedVideos()
    
    // 2. Poi carica i nuovi video
    const uploadResult = await this.uploadUpcomingVideos()
    
    // 3. Calcola lo spazio rimanente (20GB = 21474836480 bytes)
    const totalSpace = 21474836480 // 20GB in bytes
    const usedSpace = await this.getCurrentOnlySocialUsage()
    const remainingSpace = totalSpace - usedSpace

    console.log(`📊 Spazio OnlySocial: ${(usedSpace / 1024 / 1024 / 1024).toFixed(2)}GB usati / 20GB totali`)
    console.log(`📊 Spazio rimanente: ${(remainingSpace / 1024 / 1024 / 1024).toFixed(2)}GB`)

    return {
      cleanup: cleanupResult,
      upload: uploadResult,
      remainingSpace: remainingSpace
    }
  }

  /**
   * Carica un video su DigitalOcean Spaces
   */
  async uploadVideoToDO(
    file: Buffer,
    filename: string,
    _scheduledFor?: Date
  ): Promise<string> {
    try {
      const videoUrl = await this.doSpacesAPI.uploadVideo(file, filename)
      
      // Salva i metadati nel database (implementazione semplificata)
      // In realtà dovremmo usare Prisma per salvare nel database
      console.log(`✅ Video ${filename} caricato su DigitalOcean Spaces: ${videoUrl}`)
      
      return videoUrl
    } catch (error) {
      console.error(`❌ Errore caricamento video ${filename} su DO:`, error)
      throw error
    }
  }

  // ==================== HELPER METHODS ====================

  private async getUpcomingScheduledVideos(_beforeDate?: Date): Promise<VideoFile[]> {
    // Implementazione semplificata - dovrebbe interrogare il database
    // return await prisma.videoFile.findMany({
    //   where: {
    //     scheduledFor: {
    //       lte: beforeDate,
    //       gte: new Date()
    //     },
    //     status: 'pending'
    //   }
    // })
    
    return [] // Placeholder
  }

  private async downloadVideoFromDO(_key: string): Promise<Buffer> {
    // Implementazione per scaricare il video da DigitalOcean
    // Dovrebbe usare il client S3 per ottenere l'oggetto
    throw new Error('downloadVideoFromDO not implemented')
  }

  private async updateVideoStatus(
    _id: string, 
    _status: VideoFile['status'], 
    _onlySocialMediaId?: string
  ): Promise<void> {
    // Implementazione per aggiornare lo status nel database
    // await prisma.videoFile.update({
    //   where: { id },
    //   data: { status, onlySocialMediaId }
    // })
  }

  private async getCurrentOnlySocialUsage(): Promise<number> {
    // Dovrebbe calcolare l'uso attuale dello spazio OnlySocial
    // Interrogando l'API per tutti i media files e sommando le dimensioni
    try {
      const media = await this.onlySocialAPI.listMedia() as { data?: Array<{ size?: number }> }
      let totalSize = 0
      
      for (const item of media.data || []) {
        totalSize += item.size || 0
      }
      
      return totalSize
    } catch (error) {
      console.error('Errore nel calcolo dello spazio utilizzato:', error)
      return 0
    }
  }
}
