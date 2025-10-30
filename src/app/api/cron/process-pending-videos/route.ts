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
    // AGGIORNATO: Usa i nuovi stati PENDING e MEDIA_UPLOADED
    const videosToProcess = await prisma.scheduledPost.findMany({
      where: {
        OR: [
          {
            // Post in attesa che devono essere caricati entro 1 ora
            status: 'PENDING',
            preUploaded: false,
            scheduledFor: {
              lte: oneHourFromNow,
              gte: now
            }
          },
          {
            // Post già caricati da pubblicare entro 5 minuti
            status: 'MEDIA_UPLOADED',
            scheduledFor: {
              lte: new Date(now.getTime() + 5 * 60 * 1000), // +5 minuti
              gte: new Date(now.getTime() - 5 * 60 * 1000)  // -5 minuti
            }
          }
        ]
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
        const firstFilename = video.videoFilenames[0] || 'unknown'
        console.log(`🚀 Processing post ${video.id}: ${firstFilename}`)
        console.log(`   Videos: ${video.videoUrls.length}`)
        console.log(`   Scheduled for: ${video.scheduledFor.toISOString()}`)
        console.log(`   Status: ${video.status}`)
        
        // CASO 1: Post PENDING - Deve essere caricato
        if (video.status === 'PENDING' && !video.preUploaded) {
          console.log(`   → Pre-uploading videos...`)
          
          // Ottieni account ID intero
          const accountId = await onlySocialApi.getAccountIntegerId(video.accountUuid)
          
          // Upload tutti i video
          const mediaIds: string[] = []
          for (let i = 0; i < video.videoUrls.length; i++) {
            const videoUrl = video.videoUrls[i]
            const videoName = video.videoFilenames[i] || `video-${i}.mp4`
            
            console.log(`     📹 Uploading video ${i + 1}/${video.videoUrls.length}...`)
            
            const mediaResult = await onlySocialApi.uploadMediaFromDigitalOcean(
              videoUrl,
              videoName,
              `Video ${i + 1} - ${video.caption.substring(0, 50)}`
            )
            
            mediaIds.push(mediaResult.id.toString())
            console.log(`     ✅ Uploaded! Media ID: ${mediaResult.id}`)
          }
          
          console.log(`   ✅ All ${mediaIds.length} videos uploaded`)
          
          // Crea post (NON pubblica)
          const { postUuid } = await onlySocialApi.createPostWithMediaIds(
            video.accountUuid,
            video.caption,
            mediaIds.map(id => parseInt(id)),
            video.postType
          )
          
          console.log(`   ✅ Post created: ${postUuid}`)
          
          // Aggiorna database
          await prisma.scheduledPost.update({
            where: { id: video.id },
            data: {
              onlySocialMediaIds: mediaIds,
              onlySocialPostUuid: postUuid,
              accountId: accountId,
              preUploaded: true,
              preUploadAt: new Date(),
              status: 'MEDIA_UPLOADED',
              errorMessage: null,
              retryCount: 0,
              updatedAt: new Date()
            }
          })
          
          results.processed++
          console.log(`   ✅ Post ${video.id} pre-uploaded successfully`)
        }
        
        // CASO 2: Post MEDIA_UPLOADED - Deve essere pubblicato
        else if (video.status === 'MEDIA_UPLOADED' && video.onlySocialPostUuid) {
          console.log(`   → Publishing post now...`)
          
          // Pubblica immediatamente
          await onlySocialApi.publishPostNow(video.onlySocialPostUuid)
          
          console.log(`   ✅ Post published!`)
          
          // Aggiorna database
          await prisma.scheduledPost.update({
            where: { id: video.id },
            data: {
              status: 'PUBLISHED',
              publishedAt: new Date(),
              errorMessage: null,
              updatedAt: new Date()
            }
          })
          
          results.processed++
          console.log(`   ✅ Post ${video.id} published successfully`)
        }
        
        else {
          console.log(`   ⚠️ Skipping post ${video.id} - Invalid state: ${video.status}`)
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`❌ Error processing post ${video.id}:`, error)
        
        // Aggiorna con errore
        const retryCount = video.retryCount + 1
        const maxRetries = video.maxRetries || 3
        
        await prisma.scheduledPost.update({
          where: { id: video.id },
          data: {
            status: retryCount >= maxRetries ? 'FAILED' : video.status,
            errorMessage: errorMessage,
            retryCount: retryCount,
            updatedAt: new Date()
          }
        })
        
        results.failed++
        results.errors.push({
          videoId: video.id,
          filename: video.videoFilenames[0] || 'unknown',
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
