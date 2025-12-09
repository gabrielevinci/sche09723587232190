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

    // Parse la data - PostgreSQL TIMESTAMP WITH TIME ZONE gestisce automaticamente le conversioni
    // La stringa arriva nel formato: "2025-12-09T10:45:00+01:00" (ora italiana con offset)
    // PostgreSQL la salva in UTC: "2025-12-09T09:45:00Z" (conversione automatica)
    // Quando Lambda cerca in UTC, trova correttamente i post nella finestra oraria
    const scheduleDate = new Date(scheduledFor)
    if (isNaN(scheduleDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid scheduledFor date format. Use ISO 8601 format.' },
        { status: 400 }
      )
    }
    
    console.log(`⏰ Scheduling post:`)
    console.log(`   Received: ${scheduledFor}`)
    console.log(`   Will be saved in DB as UTC: ${scheduleDate.toISOString()}`)

    // Verifica che la data sia almeno 1 ora nel futuro
    const now = new Date()
    const oneHourFromNow = new Date(now.getTime() + (60 * 60 * 1000))
    
    if (scheduleDate <= oneHourFromNow) {
      return NextResponse.json(
        { error: 'Il video deve essere programmato con almeno 1 ora di anticipo' },
        { status: 400 }
      )
    }

<<<<<<< HEAD
    // Salva nel database - PostgreSQL converte automaticamente in UTC
=======
    // Salva nel database (PostgreSQL converte automaticamente in UTC)
>>>>>>> 04457cc98122d31d63e06b159c723fbe35c59a7f
    const savedPost = await saveScheduledPost({
      userId: session.user.id,
      socialAccountId,
      accountUuid,
      accountId,
      caption: caption || '',
      postType: postType || 'reel',
      videoUrls,
      videoFilenames,
      videoSizes,
<<<<<<< HEAD
      scheduledFor: scheduleDate, // NO adjustment - PostgreSQL gestisce la conversione UTC
=======
      scheduledFor: scheduleDate, // PostgreSQL salva in UTC
>>>>>>> 04457cc98122d31d63e06b159c723fbe35c59a7f
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
