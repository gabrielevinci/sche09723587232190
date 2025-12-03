/**
 * API Route: POST /api/cron/trigger
 * Endpoint chiamato dal cron job esterno ogni 50 minuti
 * 
 * Questo endpoint riceve il segnale dal cron job e coordina tutte le azioni automatiche:
 * - Controllo post da pubblicare nelle prossime 60 minuti
 * - Upload video su OnlySocial
 * - Schedulazione contenuti
 */

import { NextRequest, NextResponse } from 'next/server'
import { getScheduledPostsForUpload } from '@/lib/db/neon'
import { uploadVideoToOnlySocial, createOnlySocialPost, scheduleOnlySocialPost } from '@/lib/onlysocial'

// Secret per autenticare le chiamate dal cron job
const CRON_SECRET = process.env.CRON_SECRET

interface CronAction {
  name: string
  status: 'completed' | 'failed' | 'skipped'
  message?: string
  details?: unknown
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('🔔 ========================================')
    console.log('🔔 CRON JOB TRIGGERED!')
    console.log('🔔 Timestamp:', new Date().toISOString())
    console.log('🔔 ========================================')

    // Verifica il secret per sicurezza
    const authHeader = request.headers.get('authorization')
    const providedSecret = authHeader?.replace('Bearer ', '')

    if (!CRON_SECRET) {
      console.error('❌ CRON_SECRET non configurato nelle variabili d\'ambiente')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    if (providedSecret !== CRON_SECRET) {
      console.error('❌ Invalid cron secret')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // ✅ Autenticazione OK - Esegui le azioni
    console.log('✅ Cron job autenticato correttamente')
    console.log('📋 Inizio esecuzione azioni programmate...')

    const actions: CronAction[] = []
    
    // AZIONE 1: Calcola finestra temporale
    const now = new Date()
    const startWindow = new Date(now.getTime() - 10 * 60 * 1000) // now - 10 minuti (recupero eventuali errori)
    const endWindow = new Date(now.getTime() + 60 * 60 * 1000) // now + 60 minuti
    
    console.log('⏰ Finestra temporale:')
    console.log(`   Da: ${startWindow.toISOString()}`)
    console.log(`   A: ${endWindow.toISOString()}`)

    // AZIONE 2: Recupera post da processare
    console.log('📝 Azione: Recupero post schedulati da processare...')
    let postsToProcess
    
    try {
      postsToProcess = await getScheduledPostsForUpload(startWindow, endWindow)
      console.log(`✅ Trovati ${postsToProcess.length} post da processare`)
      
      actions.push({
        name: 'fetch_scheduled_posts',
        status: 'completed',
        message: `Trovati ${postsToProcess.length} post`,
        details: { count: postsToProcess.length }
      })
    } catch (error) {
      console.error('❌ Errore recupero post:', error)
      actions.push({
        name: 'fetch_scheduled_posts',
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }

    // AZIONE 3: Processa ogni post
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      details: [] as Array<{postId: string, status: string, error?: string}>
    }

    for (const post of postsToProcess) {
      console.log(`\n🎬 Processando post ID: ${post.id}`)
      console.log(`   Video: ${post.videoFilenames?.[0] || 'N/A'}`)
      console.log(`   Account: ${post.accountUuid}`)
      console.log(`   Scheduled for: ${post.scheduledFor}`)
      
      try {
        // Valida dati necessari
        if (!post.accountUuid || !post.accountId) {
          throw new Error('Account UUID o ID mancante')
        }

        if (!post.videoUrls || post.videoUrls.length === 0) {
          throw new Error('Video URL mancante')
        }

        // Step 1: Upload video su OnlySocial
        console.log('📤 Step 1: Upload video su OnlySocial...')
        const uploadResult = await uploadVideoToOnlySocial({
          videoUrl: post.videoUrls[0],
          filename: post.videoFilenames?.[0] || 'video.mp4'
        })
        
        console.log(`✅ Video caricato - Media ID: ${uploadResult.id}`)
        
        // Step 2: Crea post su OnlySocial
        console.log('📝 Step 2: Creazione post su OnlySocial...')
        const createResult = await createOnlySocialPost({
          accountId: post.accountId,
          mediaId: parseInt(uploadResult.id), // Converte a integer
          caption: post.caption || '',
          postType: post.postType,
          scheduledFor: post.scheduledFor
        })
        
        console.log(`✅ Post creato - UUID: ${createResult.uuid}`)
        
        // Step 3: Schedula post
        console.log('⏰ Step 3: Schedulazione post...')
        const scheduleResult = await scheduleOnlySocialPost({
          postUuid: createResult.uuid
        })
        
        console.log(`✅ Post schedulato per: ${scheduleResult.scheduled_at}`)
        
        // Step 4: Aggiorna database (sarà implementato in neon.ts)
        // await updateScheduledPostStatus(post.id, {
        //   status: 'scheduled',
        //   onlySocialMediaIds: [parseInt(uploadResult.id)],
        //   onlySocialPostUuid: createResult.uuid,
        //   onlySocialMediaUrl: uploadResult.url
        // })
        
        results.success++
        results.details.push({
          postId: post.id,
          status: 'success'
        })
        
        console.log(`✅ Post ${post.id} processato con successo!`)
        
      } catch (error) {
        console.error(`❌ Errore processando post ${post.id}:`, error)
        results.failed++
        results.details.push({
          postId: post.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        
        // TODO: Aggiornare database con errore
        // await updateScheduledPostStatus(post.id, {
        //   status: 'error',
        //   errorMessage: error.message
        // })
      }
    }

    actions.push({
      name: 'process_posts',
      status: results.failed > 0 ? 'failed' : 'completed',
      message: `Success: ${results.success}, Failed: ${results.failed}`,
      details: results
    })

    const executionTime = Date.now() - startTime
    console.log('\n✅ Esecuzione cron job completata')
    console.log(`⏱️  Tempo di esecuzione: ${executionTime}ms`)
    console.log(`📊 Risultati: ${results.success} successi, ${results.failed} errori`)
    console.log('🔔 ========================================')

    return NextResponse.json({
      success: true,
      message: 'Cron job executed successfully',
      timestamp: new Date().toISOString(),
      executionTime: `${executionTime}ms`,
      summary: {
        postsFound: postsToProcess.length,
        postsSuccess: results.success,
        postsFailed: results.failed
      },
      actions,
      details: results.details
    })

  } catch (error) {
    const executionTime = Date.now() - startTime
    console.error('❌ Errore durante esecuzione cron job:', error)
    console.log(`⏱️  Tempo di esecuzione: ${executionTime}ms`)
    console.log('🔔 ========================================')
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        executionTime: `${executionTime}ms`
      },
      { status: 500 }
    )
  }
}

// Supporta anche GET per test manuali (solo in development)
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Method not allowed in production' },
      { status: 405 }
    )
  }

  console.log('🧪 TEST CRON JOB (GET request)')
  
  return NextResponse.json({
    message: 'Cron endpoint is ready',
    environment: process.env.NODE_ENV,
    note: 'Use POST with Authorization header in production',
    testUrl: `${request.nextUrl.origin}/api/cron/trigger`
  })
}
