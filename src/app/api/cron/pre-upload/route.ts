/**
 * API Route: GET /api/cron/pre-upload
 * Cron job che PRE-CARICA i video su OnlySocial 2 ore prima della pubblicazione
 * 
 * Esegui ogni ora (cron expression: 0 ogni ora)
 * 
 * Flusso:
 * 1. Trova post da pubblicare nelle prossime 2 ore (status: PENDING, preUploaded: false)
 * 2. Converti Account UUID → Integer ID
 * 3. Upload video su OnlySocial (scarica da DO e invia con FormData)
 * 4. Crea post su OnlySocial (ma NON pubblicare)
 * 5. Aggiorna database con media IDs e post UUID (status: MEDIA_UPLOADED)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPostsDueForPreUpload, updatePostMediaIds, markPostAsFailed } from '@/lib/db/neon'
import { OnlySocialAPI } from '@/lib/onlysocial-api'

export async function GET(request: NextRequest) {
  try {
    // Verifica authorization (protezione endpoint cron)
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (authHeader !== expectedAuth) {
      console.warn('⚠️ Unauthorized cron job attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔄 Starting pre-upload cron job...')
    console.log(`   Time: ${new Date().toISOString()}`)

    // Trova post da pubblicare nelle prossime 2 ore
    const posts = await getPostsDueForPreUpload(2)

    if (posts.length === 0) {
      console.log('✅ No posts to pre-upload')
      return NextResponse.json({
        success: true,
        message: 'No posts to pre-upload',
        processed: 0,
      })
    }

    console.log(`📋 Found ${posts.length} posts to pre-upload`)

    // Inizializza OnlySocial API
    const onlySocialApi = new OnlySocialAPI({
      token: process.env.ONLYSOCIAL_API_KEY!,
      workspaceUuid: process.env.ONLYSOCIAL_WORKSPACE_UUID!,
    })

    const results = []

    for (const post of posts) {
      try {
        console.log(`\n📤 Processing post ID: ${post.id}`)
        console.log(`   Scheduled for: ${post.scheduledFor}`)
        console.log(`   Videos: ${post.videoUrls.length}`)
        console.log(`   Account UUID: ${post.accountUuid}`)

        // 1. Ottieni Account ID intero (per salvataggio nel database)
        const accountId = await onlySocialApi.getAccountIntegerId(post.accountUuid)
        console.log(`   Account ID: ${accountId}`)

        // 2. Upload tutti i video
        const mediaIds: string[] = []
        for (let i = 0; i < post.videoUrls.length; i++) {
          const videoUrl = post.videoUrls[i]
          const videoName = post.videoFilenames[i] || `video-${i}.mp4`

          console.log(`   📹 Uploading video ${i + 1}/${post.videoUrls.length}...`)
          console.log(`      URL: ${videoUrl.substring(0, 80)}...`)

          const mediaResult = await onlySocialApi.uploadMediaFromDigitalOcean(
            videoUrl,
            videoName,
            `Video ${i + 1} - ${post.caption.substring(0, 50)}`
          )

          mediaIds.push(mediaResult.id.toString())
          console.log(`      ✅ Uploaded! Media ID: ${mediaResult.id}`)
        }

        console.log(`   ✅ All ${mediaIds.length} videos uploaded: ${mediaIds.join(', ')}`)

        // 3. Crea il post (ma NON pubblicare) - usa accountUuid, non accountId
        const { postUuid } = await onlySocialApi.createPostWithMediaIds(
          post.accountUuid,  // ⚠️ Usa accountUuid (string), non accountId (number)
          post.caption,
          mediaIds.map(id => parseInt(id)),
          post.postType
        )

        console.log(`   ✅ Post created: ${postUuid}`)

        // 4. Aggiorna database con account ID intero
        await updatePostMediaIds(post.id, mediaIds, postUuid, accountId)

        console.log(`   ✅ Database updated - Status: MEDIA_UPLOADED`)

        results.push({
          postId: post.id,
          status: 'success',
          mediaIds,
          postUuid,
        })
      } catch (error) {
        console.error(`   ❌ Error processing post ${post.id}:`, error)

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        // Marca come failed nel database
        await markPostAsFailed(post.id, errorMessage)

        results.push({
          postId: post.id,
          status: 'failed',
          error: errorMessage,
        })
      }
    }

    const successCount = results.filter((r) => r.status === 'success').length
    const failedCount = results.filter((r) => r.status === 'failed').length

    console.log('\n✅ Pre-upload cron job completed')
    console.log(`   Success: ${successCount}`)
    console.log(`   Failed: ${failedCount}`)

    return NextResponse.json({
      success: true,
      processed: posts.length,
      successCount,
      failedCount,
      results,
    })
  } catch (error) {
    console.error('❌ Cron job error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
