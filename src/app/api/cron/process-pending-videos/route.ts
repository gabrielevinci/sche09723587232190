/**
 * Cron Job Endpoint - Process Pending Videos
 * 
 * Questo endpoint viene chiamato da cron-job.org ogni 10 minuti.
 * Controlla i video schedulati e carica su OnlySocial quelli da pubblicare entro 1 ora.
 * 
 * Configurazione cron-job.org:
 * - URL: https://your-app.vercel.app/api/cron/process-pending-videos
 * - Frequenza: Ogni 10 minuti
 * - Headers: Authorization: Bearer YOUR_CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { OnlySocialAPI } from '@/lib/onlysocial-api'

export async function POST(request: NextRequest) {
  try {
    // 1. Verifica autorizzazione (secret da environment variable)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (!cronSecret) {
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      )
    }
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🔄 Cron job started: Processing pending videos')
    const now = new Date()
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000) // +1 ora

    // 2. Trova video da processare
    // Cerca video con stato VIDEO_UPLOADED_DO che saranno pubblicati entro 1 ora
    const videosToProcess = await prisma.scheduledPost.findMany({
      where: {
        status: 'VIDEO_UPLOADED_DO',
        scheduledFor: {
          lte: oneHourFromNow, // <= 1 ora da adesso
          gte: now // >= adesso (non nel passato)
        }
      },
      orderBy: {
        scheduledFor: 'asc'
      }
    })

    console.log(`📊 Found ${videosToProcess.length} videos to process`)

    if (videosToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No videos to process',
        processed: 0
      })
    }

    // 3. Inizializza OnlySocial API
    const onlySocialToken = process.env.ONLYSOCIAL_API_KEY
    const workspaceUuid = process.env.ONLYSOCIAL_WORKSPACE_UUID

    if (!onlySocialToken || !workspaceUuid) {
      throw new Error('OnlySocial credentials not configured')
    }

    const onlySocialApi = new OnlySocialAPI({
      token: onlySocialToken,
      workspaceUuid: workspaceUuid
    })

    interface VideoError {
      videoId: string
      filename: string
      error: string
      retryCount: number
    }

    const results = {
      processed: 0,
      failed: 0,
      errors: [] as VideoError[]
    }

    // 4. Processa ogni video
    for (const video of videosToProcess) {
      try {
        console.log(`🚀 Processing video ${video.id}: ${video.videoFilename}`)
        console.log(`   Scheduled for: ${video.scheduledFor.toISOString()}`)
        
        // Step 1: Carica video su OnlySocial
        const mediaResult = await onlySocialApi.uploadMedia({
          file: video.videoUrl,
          alt_text: video.caption
        })
        
        interface MediaData {
          id?: number
          uuid?: string
          url: string
        }
        
        const mediaData = (mediaResult as { data: MediaData }).data
        const mediaId = mediaData.id || mediaData.uuid
        
        console.log(`✅ Video uploaded to OnlySocial, ID: ${mediaId}`)
        
        // Step 2: Ottieni account social
        const socialAccount = await prisma.socialAccount.findUnique({
          where: { id: video.socialAccountId }
        })
        
        if (!socialAccount) {
          throw new Error(`Social account ${video.socialAccountId} not found`)
        }
        
        // Step 3: Schedula post su OnlySocial
        const scheduledDate = new Date(video.scheduledFor)
        const year = scheduledDate.getFullYear()
        const month = scheduledDate.getMonth() + 1
        const day = scheduledDate.getDate()
        const hour = scheduledDate.getHours()
        const minute = scheduledDate.getMinutes()
        
        console.log(`📝 Creating post for account ID: ${socialAccount.accountId}`)
        
        // ✅ Usa il media ID già caricato, NON ri-caricare il video
        const mediaIdNumber = typeof mediaId === 'string' ? parseInt(mediaId, 10) : mediaId as number
        
        const postResult = await onlySocialApi.createAndSchedulePostWithMediaIds(
          socialAccount.accountId, // UUID dell'account OnlySocial
          video.caption,
          [mediaIdNumber], // Array di ID dei media già caricati
          year,
          month,
          day,
          hour,
          minute,
          video.postType
        )
        
        const postId = postResult.postUuid
        
        console.log(`✅ Post scheduled on OnlySocial, UUID: ${postId}`)
        
        // Step 4: Aggiorna database
        await prisma.scheduledPost.update({
          where: { id: video.id },
          data: {
            status: 'SCHEDULED',
            onlySocialMediaId: String(mediaId),
            onlySocialPostId: String(postId),
            onlySocialMediaUrl: mediaData.url,
            uploadedToOSAt: new Date(),
            scheduledAt: new Date(),
            errorMessage: null,
            retryCount: 0
          }
        })
        
        results.processed++
        console.log(`✅ Video ${video.id} processed successfully`)
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`❌ Error processing video ${video.id}:`, error)
        
        // Aggiorna con errore
        const retryCount = video.retryCount + 1
        const maxRetries = 3
        
        await prisma.scheduledPost.update({
          where: { id: video.id },
          data: {
            status: retryCount >= maxRetries ? 'FAILED' : 'VIDEO_UPLOADED_DO',
            errorMessage: errorMessage,
            retryCount: retryCount
          }
        })
        
        results.failed++
        results.errors.push({
          videoId: video.id,
          filename: video.videoFilename,
          error: errorMessage,
          retryCount: retryCount
        })
      }
    }

    console.log(`✅ Cron job completed`)
    console.log(`   - Processed: ${results.processed}`)
    console.log(`   - Failed: ${results.failed}`)

    return NextResponse.json({
      success: true,
      summary: {
        total: videosToProcess.length,
        processed: results.processed,
        failed: results.failed
      },
      errors: results.errors
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    console.error('❌ Cron job error:', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// GET per verificare che l'endpoint funzioni
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Cron endpoint is ready. Use POST with Authorization header.',
    info: {
      frequency: 'Every 10 minutes',
      action: 'Process videos scheduled within 1 hour'
    }
  })
}
