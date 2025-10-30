/**
 * API Route: GET /api/cron/publish
 * Cron job che PUBBLICA i post all'ora programmata
 * 
 * Esegui ogni 5 minuti (cron expression: ogni 5 minuti)
 * 
 * Flusso:
 * 1. Trova post da pubblicare ORA (status: MEDIA_UPLOADED, scheduledFor in finestra ±5 minuti)
 * 2. Pubblica IMMEDIATAMENTE su OnlySocial con postNow: true
 * 3. Aggiorna database con status: PUBLISHED e publishedAt timestamp
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPostsDueForPublishing, markPostAsPublished, markPostAsFailed } from '@/lib/db/neon'
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

    console.log('🚀 Starting publish cron job...')
    console.log(`   Time: ${new Date().toISOString()}`)

    // Trova post da pubblicare ORA (finestra di ±5 minuti)
    const posts = await getPostsDueForPublishing(5)

    if (posts.length === 0) {
      console.log('✅ No posts to publish')
      return NextResponse.json({
        success: true,
        message: 'No posts to publish',
        published: 0,
      })
    }

    console.log(`📋 Found ${posts.length} posts to publish NOW`)

    // Inizializza OnlySocial API
    const onlySocialApi = new OnlySocialAPI({
      token: process.env.ONLYSOCIAL_API_KEY!,
      workspaceUuid: process.env.ONLYSOCIAL_WORKSPACE_UUID!,
    })

    const results = []

    for (const post of posts) {
      try {
        if (!post.onlySocialPostUuid) {
          throw new Error('Post UUID not found - post may not have been pre-uploaded correctly')
        }

        console.log(`\n🚀 Publishing post ID: ${post.id}`)
        console.log(`   Post UUID: ${post.onlySocialPostUuid}`)
        console.log(`   Scheduled for: ${post.scheduledFor}`)
        console.log(`   Caption: ${post.caption.substring(0, 50)}...`)

        // Pubblica IMMEDIATAMENTE con postNow: true
        const publishResult = await onlySocialApi.publishPostNow(post.onlySocialPostUuid)

        console.log(`   ✅ Published successfully!`)
        console.log(`   Result:`, JSON.stringify(publishResult).substring(0, 200))

        // Aggiorna database
        await markPostAsPublished(post.id)

        console.log(`   ✅ Database updated - Status: PUBLISHED`)

        results.push({
          postId: post.id,
          status: 'published',
          publishedAt: new Date().toISOString(),
        })
      } catch (error) {
        console.error(`   ❌ Error publishing post ${post.id}:`, error)

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

    const publishedCount = results.filter((r) => r.status === 'published').length
    const failedCount = results.filter((r) => r.status === 'failed').length

    console.log('\n✅ Publish cron job completed')
    console.log(`   Published: ${publishedCount}`)
    console.log(`   Failed: ${failedCount}`)

    return NextResponse.json({
      success: true,
      processed: posts.length,
      publishedCount,
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
