/**
 * API Route: POST /api/posts/schedule
 * Salva un post programmato nel database
 * 
 * IMPORTANTE: Tutti gli orari sono in formato italiano (Europe/Rome, UTC+1)
 * - Il frontend invia date in formato italiano
 * - Il backend salva le date in formato italiano
 * - OnlySocial API usa lo stesso fuso orario italiano
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { saveScheduledPost } from '@/lib/db/neon'

interface SchedulePostRequest {
  socialAccountId: string
  accountUuid?: string   // UUID OnlySocial API
  accountId?: number     // ID numerico OnlySocial API
  caption: string
  postType?: string
  videoUrls: string[]
  videoFilenames: string[]
  videoSizes: number[]
  scheduledFor: string   // ISO 8601 datetime string in formato italiano
  timezone?: string      // Default: 'Europe/Rome'
}

export async function POST(request: NextRequest) {
  try {
    // Verifica autenticazione
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body: SchedulePostRequest = await request.json()

    const {
      socialAccountId,
      accountUuid,
      accountId,
      caption,
      postType,
      videoUrls,
      videoFilenames,
      videoSizes,
      scheduledFor,
      timezone,
    } = body

    // Validazione
    if (!socialAccountId || !videoUrls || !scheduledFor) {
      return NextResponse.json(
        { error: 'Missing required fields: socialAccountId, videoUrls, scheduledFor' },
        { status: 400 }
      )
    }

    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return NextResponse.json(
        { error: 'videoUrls must be a non-empty array' },
        { status: 400 }
      )
    }

    if (!Array.isArray(videoFilenames) || videoFilenames.length !== videoUrls.length) {
      return NextResponse.json(
        { error: 'videoFilenames must be an array with same length as videoUrls' },
        { status: 400 }
      )
    }

    if (!Array.isArray(videoSizes) || videoSizes.length !== videoUrls.length) {
      return NextResponse.json(
        { error: 'videoSizes must be an array with same length as videoUrls' },
        { status: 400 }
      )
    }

    // Parse la data mantenendo l'orario italiano
    // La stringa arriva nel formato: "2025-12-13T13:00:00+01:00"
    const scheduleDate = new Date(scheduledFor)
    if (isNaN(scheduleDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid scheduledFor date format. Use ISO 8601 format.' },
        { status: 400 }
      )
    }

    // IMPORTANTE: PostgreSQL converte in UTC quando salva, ma noi vogliamo mantenere l'orario italiano
    // Quindi quando riceviamo "13:00+01:00", PostgreSQL lo converte in "12:00Z"
    // Per compensare, aggiungiamo 1 ora alla data PRIMA di salvare
    // Così PostgreSQL salverà "13:00Z" che è l'orario che vogliamo vedere
    const scheduleDateAdjusted = new Date(scheduleDate.getTime() + (60 * 60 * 1000)) // +1 ora
    
    console.log(`⏰ Date adjustment for Italian timezone:`)
    console.log(`   Received: ${scheduledFor}`)
    console.log(`   Parsed: ${scheduleDate.toISOString()}`)
    console.log(`   Adjusted (+1h): ${scheduleDateAdjusted.toISOString()}`)

    // Verifica che la data sia almeno 1 ora nel futuro
    const now = new Date()
    const oneHourFromNow = new Date(now.getTime() + (60 * 60 * 1000)) // +1 ora da ora
    
    if (scheduleDate <= oneHourFromNow) {
      return NextResponse.json(
        { error: 'Il video deve essere programmato con almeno 1 ora di anticipo' },
        { status: 400 }
      )
    }

    // Salva nel database con la data aggiustata
    const savedPost = await saveScheduledPost({
      userId: session.user.id,
      socialAccountId,
      accountUuid,
      accountId,
      caption: caption || '', // Lascia vuoto se non fornita
      postType: postType || 'reel',
      videoUrls,
      videoFilenames,
      videoSizes,
      scheduledFor: scheduleDateAdjusted, // Usa la data aggiustata
      timezone: timezone || 'Europe/Rome',
    })

    console.log(`✅ Post scheduled successfully!`)
    console.log(`   Post ID: ${savedPost.id}`)
    console.log(`   User ID: ${session.user.id}`)
    console.log(`   Videos: ${videoUrls.length}`)
    console.log(`   Scheduled for: ${savedPost.scheduledFor}`)

    return NextResponse.json({
      success: true,
      postId: savedPost.id,
      scheduledFor: savedPost.scheduledFor,
      message: 'Post scheduled successfully. Videos will be uploaded 2 hours before publication.',
    })
  } catch (error) {
    console.error('❌ Error scheduling post:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
