/**
 * Cron Job Endpoint - Process Pending Videos
 * 
 * FLUSSO OTTIMIZZATO (2025-10-30):
 * 1. Pre-Upload (PENDING → MEDIA_UPLOADED): Solo carica video, NON crea post
 * 2. Publish (MEDIA_UPLOADED → PUBLISHED): Crea post + pubblica immediatamente
 * 
 * Questo risolve l'errore "no_media_selected" perché i media vengono
 * associati al post solo al momento della pubblicazione.
 * 
 * Configurazione: Ogni 5 minuti (bilanciato)
 * Headers: Authorization: Bearer YOUR_CRON_SECRET
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

    // =====================================
    // 🚀 INIZIO CRON JOB
    // =====================================
    const now = new Date()
    const startTime = Date.now()
    console.log('\n' + '='.repeat(60))
    console.log('🔄 CRON JOB STARTED - Process Pending Videos')
    console.log('='.repeat(60))
    console.log(`⏰ Timestamp: ${now.toISOString()}`)
    
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

    // =====================================
    // 📊 QUERY DATABASE
    // =====================================
    console.log('\n📊 Querying database for posts to process...')
    
    const videosToProcess = await prisma.scheduledPost.findMany({
      where: {
        OR: [
          {
            // Post in attesa che devono essere caricati entro 1 ora
            status: 'PENDING',
            preUploaded: false,
            scheduledFor: {
              lte: oneHourFromNow,
            }
          },
          {
            // Post già caricati da pubblicare (finestra: -2h a +5min)
            status: 'MEDIA_UPLOADED',
            scheduledFor: {
              lte: new Date(now.getTime() + 5 * 60 * 1000),
              gte: new Date(now.getTime() - 120 * 60 * 1000)
            }
          }
        ]
      },
      orderBy: {
        scheduledFor: 'asc'
      }
    })

    const pendingCount = videosToProcess.filter(v => v.status === 'PENDING').length
    const uploadedCount = videosToProcess.filter(v => v.status === 'MEDIA_UPLOADED').length
    
    console.log(`   ✅ Found ${videosToProcess.length} posts total`)
    console.log(`      - PENDING (to pre-upload): ${pendingCount}`)
    console.log(`      - MEDIA_UPLOADED (to publish): ${uploadedCount}`)

    if (videosToProcess.length === 0) {
      console.log('   ℹ️  No videos to process at this time')
      console.log('=' .repeat(60) + '\n')
      return NextResponse.json({
        success: true,
        message: 'No videos to process',
        processed: 0
      })
    }

    // =====================================
    // 🔧 INIZIALIZZA ONLYSOCIAL API
    // =====================================
    console.log('\n🔧 Initializing OnlySocial API...')
    
    const onlySocialToken = process.env.ONLYSOCIAL_API_KEY
    const workspaceUuid = process.env.ONLYSOCIAL_WORKSPACE_UUID

    if (!onlySocialToken || !workspaceUuid) {
      throw new Error('OnlySocial credentials not configured')
    }

    const onlySocialApi = new OnlySocialAPI({
      token: onlySocialToken,
      workspaceUuid: workspaceUuid
    })
    
    console.log(`   ✅ API initialized (Workspace: ${workspaceUuid.substring(0, 8)}...)`)

    // =====================================
    // 🔄 PROCESSA OGNI POST
    // =====================================
    console.log('\n🔄 Processing posts...\n')
    
    interface VideoError {
      videoId: string
      filename: string
      error: string
      retryCount: number
    }
    
    const results = {
      preUploaded: 0,
      published: 0,
      failed: 0,
      errors: [] as VideoError[]
    }

    // 4. Processa ogni video
    for (let index = 0; index < videosToProcess.length; index++) {
      const video = videosToProcess[index]
      const firstFilename = video.videoFilenames[0] || 'unknown'
      const diffMinutes = Math.round((video.scheduledFor.getTime() - now.getTime()) / 60000)
      
      console.log(`\n[${ index + 1}/${videosToProcess.length}] 📌 Post ID: ${video.id}`)
      console.log(`   Caption: ${video.caption.substring(0, 60)}...`)
      console.log(`   Filename: ${firstFilename}`)
      console.log(`   Status: ${video.status}`)
      console.log(`   Scheduled: ${video.scheduledFor.toISOString()} (${diffMinutes > 0 ? '+' : ''}${diffMinutes}min)`)
      
      try {
        // =====================================
        // CASO 1: PENDING → Pre-upload video
        // =====================================
        if (video.status === 'PENDING' && !video.preUploaded) {
          console.log(`   🔄 Action: PRE-UPLOAD (carica video su OnlySocial)`)
          
          // Ottieni account ID intero
          const accountId = await onlySocialApi.getAccountIntegerId(video.accountUuid)
          console.log(`   👤 Account ID: ${accountId}`)
          
          // Upload tutti i video
          const mediaIds: string[] = []
          for (let i = 0; i < video.videoUrls.length; i++) {
            const videoUrl = video.videoUrls[i]
            const videoName = video.videoFilenames[i] || `video-${i}.mp4`
            
            console.log(`   📹 Uploading video ${i + 1}/${video.videoUrls.length}: ${videoName}`)
            
            const mediaResult = await onlySocialApi.uploadMediaFromDigitalOcean(
              videoUrl,
              videoName,
              `Video ${i + 1} - ${video.caption.substring(0, 50)}`
            )
            
            mediaIds.push(mediaResult.id.toString())
            console.log(`      ✅ Uploaded! Media ID: ${mediaResult.id}`)
          }
          
          console.log(`   ✅ All ${mediaIds.length} video(s) uploaded successfully`)
          
          // ⚠️ NON creare il post ora! Solo salvare i media IDs
          // Il post verrà creato al momento della pubblicazione
          console.log(`   💾 Saving media IDs to database (NO post creation yet)`)
          
          // Aggiorna database
          await prisma.scheduledPost.update({
            where: { id: video.id },
            data: {
              onlySocialMediaIds: mediaIds,
              onlySocialPostUuid: null, // ⚠️ NULL perché il post non è ancora creato
              accountId: accountId,
              preUploaded: true,
              preUploadAt: new Date(),
              status: 'MEDIA_UPLOADED',
              errorMessage: null,
              retryCount: 0,
              updatedAt: new Date()
            }
          })
          
          results.preUploaded++
          console.log(`   ✅ PRE-UPLOAD COMPLETED - Status: MEDIA_UPLOADED`)
        }
        
        // =====================================
        // CASO 2: MEDIA_UPLOADED → Pubblica
        // =====================================
        else if (video.status === 'MEDIA_UPLOADED') {
          console.log(`   🔄 Action: PUBLISH (crea post + pubblica immediatamente)`)
          
          // Verifica che i media IDs esistano
          if (!video.onlySocialMediaIds || video.onlySocialMediaIds.length === 0) {
            throw new Error('No media IDs found - post was not properly pre-uploaded')
          }
          
          console.log(`   📦 Media IDs: ${video.onlySocialMediaIds.join(', ')}`)
          
          // Converti media IDs in numeri
          const mediaIdsNumbers = video.onlySocialMediaIds.map(id => parseInt(id, 10))
          
          // ⚠️ NUOVO APPROCCIO: Crea il post ADESSO (non durante pre-upload)
          console.log(`   📝 Creating post on OnlySocial with pre-uploaded media...`)
          
          const { postUuid } = await onlySocialApi.createPostWithMediaIds(
            video.accountUuid,
            video.caption,
            mediaIdsNumbers,
            video.postType
          )
          
          console.log(`   ✅ Post created! UUID: ${postUuid}`)
          
          // Pubblica immediatamente
          console.log(`   🚀 Publishing post NOW...`)
          const publishResult = await onlySocialApi.publishPostNow(postUuid)
          
          console.log(`   ✅ Post published successfully!`)
          
          // Aggiorna database
          await prisma.scheduledPost.update({
            where: { id: video.id },
            data: {
              onlySocialPostUuid: postUuid,
              status: 'PUBLISHED',
              publishedAt: new Date(),
              errorMessage: null,
              updatedAt: new Date()
            }
          })
          
          results.published++
          console.log(`   ✅ PUBLISH COMPLETED - Status: PUBLISHED`)
        }
        
        else {
          console.log(`   ⚠️  SKIPPED - Invalid state (status: ${video.status}, preUploaded: ${video.preUploaded})`)
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.log(`   ❌ ERROR: ${errorMessage}`)
        
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

    // =====================================
    // ✅ RIEPILOGO FINALE
    // =====================================
    const totalProcessed = results.preUploaded + results.published
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2)
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ CRON JOB COMPLETED')
    console.log('='.repeat(60))
    console.log(`⏱️  Execution time: ${elapsedTime}s`)
    console.log(`📊 Summary:`)
    console.log(`   - Pre-uploaded: ${results.preUploaded}`)
    console.log(`   - Published: ${results.published}`)
    console.log(`   - Failed: ${results.failed}`)
    console.log(`   - Total processed: ${totalProcessed}`)
    
    if (results.errors.length > 0) {
      console.log(`\n⚠️  Errors:`)
      results.errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err.filename}: ${err.error} (retry ${err.retryCount}/${err.retryCount >= 3 ? 'MAX' : '3'})`)
      })
    }
    
    console.log('='.repeat(60) + '\n')

    return NextResponse.json({
      success: true,
      summary: {
        total: videosToProcess.length,
        preUploaded: results.preUploaded,
        published: results.published,
        failed: results.failed,
        executionTime: `${elapsedTime}s`
      },
      errors: results.errors
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    console.error('\n' + '='.repeat(60))
    console.error('❌ CRON JOB ERROR')
    console.error('='.repeat(60))
    console.error(`Error: ${errorMessage}`)
    console.error('='.repeat(60) + '\n')
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage 
      },
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
      frequency: 'Every 5 minutes (recommended)',
      phases: {
        preUpload: 'PENDING → MEDIA_UPLOADED (uploads videos, saves media IDs)',
        publish: 'MEDIA_UPLOADED → PUBLISHED (creates post + publishes immediately)'
      }
    }
  })
}
