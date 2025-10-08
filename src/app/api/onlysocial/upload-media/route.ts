/**
 * API Route: Upload Media to OnlySocial
 * POST /api/onlysocial/upload-media
 * 
 * Questo endpoint scarica video da DigitalOcean Spaces e li carica su OnlySocial
 * usando il metodo corretto con FormData (multipart/form-data)
 * 
 * Body:
 * {
 *   "digitalOceanUrl": "https://scheduler-0chiacchiere.lon1.digitaloceanspaces.com/path/video.mp4",
 *   "videoName": "video.mp4",
 *   "altText": "Descrizione video" // opzionale
 * }
 * 
 * Response Success (200):
 * {
 *   "success": true,
 *   "mediaId": 123456,
 *   "mediaUuid": "abc-def-123",
 *   "mediaUrl": "https://storage.onlysocial.io/.../video.mp4",
 *   "thumbUrl": "https://storage.onlysocial.io/.../thumb.jpg",
 *   "data": { ... full media object ... }
 * }
 * 
 * Response Error (400/500):
 * {
 *   "success": false,
 *   "error": "Messaggio di errore"
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { OnlySocialAPI } from '@/lib/onlysocial-api'

// Configurazione per upload di file grandi
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minuti

export async function POST(request: NextRequest) {
  try {
    // 1. Verifica autenticazione
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Non autenticato' },
        { status: 401 }
      )
    }

    // 2. Parse request body
    const body = await request.json()
    const { digitalOceanUrl, videoName, altText } = body

    // 3. Validazione input
    if (!digitalOceanUrl || !videoName) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'digitalOceanUrl e videoName sono obbligatori' 
        },
        { status: 400 }
      )
    }

    // 4. Verifica configurazione OnlySocial
    const token = process.env.ONLYSOCIAL_API_KEY
    const workspaceUuid = process.env.ONLYSOCIAL_WORKSPACE_UUID

    if (!token || !workspaceUuid) {
      console.error('OnlySocial configuration missing:', { 
        hasToken: !!token, 
        hasWorkspace: !!workspaceUuid 
      })
      return NextResponse.json(
        { 
          success: false, 
          error: 'Configurazione OnlySocial mancante' 
        },
        { status: 500 }
      )
    }

    // 5. Inizializza OnlySocial API client
    const api = new OnlySocialAPI({ token, workspaceUuid })

    console.log('📤 Starting media upload to OnlySocial...')
    console.log(`   Video: ${videoName}`)
    console.log(`   Source: ${digitalOceanUrl.substring(0, 60)}...`)

    // 6. Carica il video su OnlySocial
    // Questo metodo scarica il video da DigitalOcean e lo carica su OnlySocial
    // usando multipart/form-data con FormData
    const result = await api.uploadMediaFromDigitalOcean(
      digitalOceanUrl,
      videoName,
      altText
    )

    console.log('✅ Media uploaded successfully!')
    console.log(`   Media ID: ${result.id}`)
    console.log(`   Media UUID: ${result.uuid}`)

    // 7. Ritorna il risultato
    return NextResponse.json({
      success: true,
      mediaId: result.id,
      mediaUuid: result.uuid,
      mediaUrl: result.url,
      thumbUrl: result.thumb_url,
      mimeType: result.mime_type,
      type: result.type,
      isVideo: result.is_video,
      data: result
    }, { status: 200 })

  } catch (error) {
    console.error('❌ Error uploading media to OnlySocial:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto'
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Errore durante l'upload: ${errorMessage}` 
      },
      { status: 500 }
    )
  }
}

/**
 * Batch upload endpoint - carica multipli video in parallelo
 * POST /api/onlysocial/upload-media con array
 * 
 * Body:
 * {
 *   "videos": [
 *     { "digitalOceanUrl": "...", "videoName": "video1.mp4", "altText": "..." },
 *     { "digitalOceanUrl": "...", "videoName": "video2.mp4", "altText": "..." }
 *   ]
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    // 1. Verifica autenticazione
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Non autenticato' },
        { status: 401 }
      )
    }

    // 2. Parse request body
    const body = await request.json()
    const { videos } = body

    // 3. Validazione input
    if (!Array.isArray(videos) || videos.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Fornire un array di video da caricare' 
        },
        { status: 400 }
      )
    }

    // 4. Verifica configurazione OnlySocial
    const token = process.env.ONLYSOCIAL_API_KEY
    const workspaceUuid = process.env.ONLYSOCIAL_WORKSPACE_UUID

    if (!token || !workspaceUuid) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Configurazione OnlySocial mancante' 
        },
        { status: 500 }
      )
    }

    // 5. Inizializza OnlySocial API client
    const api = new OnlySocialAPI({ token, workspaceUuid })

    console.log(`📤 Starting batch upload of ${videos.length} videos...`)

    // 6. Carica tutti i video in parallelo
    const uploadPromises = videos.map(video => 
      api.uploadMediaFromDigitalOcean(
        video.digitalOceanUrl,
        video.videoName,
        video.altText
      ).catch(error => ({
        error: true,
        message: error.message,
        videoName: video.videoName
      }))
    )

    const results = await Promise.all(uploadPromises)

    // 7. Separa successi da errori
    const successes = results.filter(r => !('error' in r))
    const failures = results.filter(r => 'error' in r)

    console.log(`✅ Batch upload complete: ${successes.length} succeeded, ${failures.length} failed`)

    return NextResponse.json({
      success: failures.length === 0,
      totalVideos: videos.length,
      successCount: successes.length,
      failureCount: failures.length,
      successes: successes.map(r => ({
        mediaId: (r as { id: number }).id,
        mediaUuid: (r as { uuid: string }).uuid,
        mediaUrl: (r as { url: string }).url
      })),
      failures: failures
    }, { status: 200 })

  } catch (error) {
    console.error('❌ Error in batch upload:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto'
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Errore durante il batch upload: ${errorMessage}` 
      },
      { status: 500 }
    )
  }
}
