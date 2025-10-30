/**
 * Cron Job Endpoint - Process Pending Videos
 * 
 * FLUSSO OTTIMIZZATO (2025-10-30) - FIX MEDIA ID BUG:
 * 
 * PROBLEMA RISOLTO:
 * - Il vecchio sistema processava PENDING e MEDIA_UPLOADED nello stesso loop
 * - La variabile `video` conteneva dati stantii dal database
 * - Quando un post passava da PENDING → MEDIA_UPLOADED nello stesso run,
 *   la variabile `video.onlySocialMediaIds` era ancora null/vecchia
 * 
 * SOLUZIONE:
 * - Due query separate: una per PENDING, una per MEDIA_UPLOADED
 * - Due cicli separati: FASE 1 (pre-upload) e FASE 2 (publish)
 * - I post vengono processati in run successivi (non nello stesso run)
 * 
 * FLUSSO:
 * 1. Pre-Upload (PENDING → MEDIA_UPLOADED): Solo carica video, NON crea post
 * 2. Publish (MEDIA_UPLOADED → PUBLISHED): Crea post + pubblica immediatamente
 * 
 * Configurazione: Ogni 5 minuti (bilanciato)
 * Headers: Authorization: Bearer YOUR_CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { OnlySocialAPI } from '@/lib/onlysocial-api'

interface VideoError {
  videoId: string
  filename: string
  error: string
  retryCount: number
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verifica autorizzazione
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
    // 📊 QUERY DATABASE - FASE 1: PRE-UPLOAD
    // =====================================
    console.log('\n📊 FASE 1: Querying PENDING posts for pre-upload...')
    
    const pendingVideos = await prisma.scheduledPost.findMany({
      where: {
        status: 'PENDING',
        preUploaded: false,
        scheduledFor: {
          lte: oneHourFromNow,
        }
      },
      orderBy: {
        scheduledFor: 'asc'
      }
    })
    
    console.log(`   ✅ Found ${pendingVideos.length} PENDING posts to pre-upload`)

    // =====================================
    // 📊 QUERY DATABASE - FASE 2: PUBLISH
    // =====================================
    console.log('\n📊 FASE 2: Querying MEDIA_UPLOADED posts for publishing...')
    
    const uploadedVideos = await prisma.scheduledPost.findMany({
      where: {
        status: 'MEDIA_UPLOADED',
        scheduledFor: {
          lte: new Date(now.getTime() + 5 * 60 * 1000),
          gte: new Date(now.getTime() - 120 * 60 * 1000)
        }
      },
      orderBy: {
        scheduledFor: 'asc'
      }
    })
    
    console.log(`   ✅ Found ${uploadedVideos.length} MEDIA_UPLOADED posts to publish`)

    const totalPosts = pendingVideos.length + uploadedVideos.length

    if (totalPosts === 0) {
      console.log('\n   ℹ️  No videos to process at this time')
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

    const results = {
      preUploaded: 0,
      published: 0,
      failed: 0,
      errors: [] as VideoError[]
    }

    // =====================================
    // 🔄 FASE 1: PRE-UPLOAD (PENDING → MEDIA_UPLOADED)
    // =====================================
    console.log('\n' + '='.repeat(60))
    console.log('📤 FASE 1: PRE-UPLOAD')
    console.log('='.repeat(60))
    
    for (let index = 0; index < pendingVideos.length; index++) {
      const video = pendingVideos[index]
      const firstFilename = video.videoFilenames[0] || 'unknown'
      const diffMinutes = Math.round((video.scheduledFor.getTime() - now.getTime()) / 60000)
      
      console.log(`\n[${index + 1}/${pendingVideos.length}] 📌 Post ID: ${video.id}`)
      console.log(`   Caption: ${video.caption.substring(0, 60)}...`)
      console.log(`   Filename: ${firstFilename}`)
      console.log(`   Status: ${video.status}`)
      console.log(`   Scheduled: ${video.scheduledFor.toISOString()} (${diffMinutes > 0 ? '+' : ''}${diffMinutes}min)`)
      
      try {
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
          
          console.log(`      📋 Full upload response:`, JSON.stringify(mediaResult, null, 2))
          console.log(`      🔍 Extracted Media ID: ${mediaResult.id}`)
          console.log(`      🔍 Media ID type: ${typeof mediaResult.id}`)
          
          mediaIds.push(mediaResult.id.toString())
          console.log(`      ✅ Uploaded! Media ID saved: ${mediaResult.id}`)
        }
        
        console.log(`   ✅ All ${mediaIds.length} video(s) uploaded successfully`)
        console.log(`   💾 Saving media IDs to database: [${mediaIds.join(', ')}]`)
        
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
        
      } catch (error) {
        results.failed++
        const errorMessage = error instanceof Error ? error.message : String(error)
        const newRetryCount = video.retryCount + 1
        
        console.error(`   ❌ PRE-UPLOAD FAILED:`, errorMessage)
        console.error(`   🔄 Retry count: ${newRetryCount}/${video.maxRetries}`)
        
        results.errors.push({
          videoId: video.id,
          filename: firstFilename,
          error: errorMessage,
          retryCount: newRetryCount
        })
        
        await prisma.scheduledPost.update({
          where: { id: video.id },
          data: {
            errorMessage: errorMessage.substring(0, 500),
            retryCount: newRetryCount,
            status: newRetryCount >= video.maxRetries ? 'FAILED' : 'PENDING',
            updatedAt: new Date()
          }
        })
        
        if (newRetryCount >= video.maxRetries) {
          console.error(`   ⚠️  Max retries reached - Status set to FAILED`)
        }
      }
    }

    // =====================================
    // 🔄 FASE 2: PUBLISH (MEDIA_UPLOADED → PUBLISHED)
    // =====================================
    console.log('\n' + '='.repeat(60))
    console.log('🚀 FASE 2: PUBLISH')
    console.log('='.repeat(60))
    
    for (let index = 0; index < uploadedVideos.length; index++) {
      const video = uploadedVideos[index]
      const firstFilename = video.videoFilenames[0] || 'unknown'
      const diffMinutes = Math.round((video.scheduledFor.getTime() - now.getTime()) / 60000)
      
      console.log(`\n[${index + 1}/${uploadedVideos.length}] 📌 Post ID: ${video.id}`)
      console.log(`   Caption: ${video.caption.substring(0, 60)}...`)
      console.log(`   Filename: ${firstFilename}`)
      console.log(`   Status: ${video.status}`)
      console.log(`   Scheduled: ${video.scheduledFor.toISOString()} (${diffMinutes > 0 ? '+' : ''}${diffMinutes}min)`)
      
      try {
        console.log(`   🔄 Action: PUBLISH (crea post + pubblica immediatamente)`)
        
        // Verifica che i media IDs esistano
        if (!video.onlySocialMediaIds || video.onlySocialMediaIds.length === 0) {
          throw new Error('No media IDs found - post was not properly pre-uploaded')
        }
        
        console.log(`   📦 Media IDs from DB: [${video.onlySocialMediaIds.join(', ')}]`)
        
        // Converti media IDs in numeri
        const mediaIdsNumbers = video.onlySocialMediaIds.map((id: string) => parseInt(id, 10))
        
        console.log(`   🔍 Converted to numbers: [${mediaIdsNumbers.join(', ')}]`)
        
        // Crea il post ADESSO (non durante pre-upload)
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
        await onlySocialApi.publishPostNow(postUuid)
        
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
        
      } catch (error) {
        results.failed++
        const errorMessage = error instanceof Error ? error.message : String(error)
        const newRetryCount = video.retryCount + 1
        
        console.error(`   ❌ PUBLISH FAILED:`, errorMessage)
        console.error(`   🔄 Retry count: ${newRetryCount}/${video.maxRetries}`)
        
        results.errors.push({
          videoId: video.id,
          filename: firstFilename,
          error: errorMessage,
          retryCount: newRetryCount
        })
        
        await prisma.scheduledPost.update({
          where: { id: video.id },
          data: {
            errorMessage: errorMessage.substring(0, 500),
            retryCount: newRetryCount,
            status: newRetryCount >= video.maxRetries ? 'FAILED' : 'MEDIA_UPLOADED',
            updatedAt: new Date()
          }
        })
        
        if (newRetryCount >= video.maxRetries) {
          console.error(`   ⚠️  Max retries reached - Status set to FAILED`)
        }
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
        total: totalPosts,
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
    message: 'Process pending videos endpoint is running',
    usage: 'Send POST request with Authorization: Bearer YOUR_CRON_SECRET'
  })
}
