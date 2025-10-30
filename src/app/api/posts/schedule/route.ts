/**
 * API Route: POST /api/posts/schedule
 * Salva un post programmato nel database
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { saveScheduledPost } from '@/lib/db/neon'

interface SchedulePostRequest {
  socialAccountId: string
  accountUuid: string
  caption: string
  postType?: string
  videoUrls: string[]
  videoFilenames: string[]
  videoSizes: number[]
  scheduledFor: string // ISO 8601 datetime string
  timezone?: string
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
      caption,
      postType,
      videoUrls,
      videoFilenames,
      videoSizes,
      scheduledFor,
      timezone,
    } = body

    // Validazione
    if (!socialAccountId || !accountUuid || !videoUrls || !scheduledFor) {
      return NextResponse.json(
        { error: 'Missing required fields: socialAccountId, accountUuid, videoUrls, scheduledFor' },
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

    // Verifica che la data sia nel futuro
    const scheduleDate = new Date(scheduledFor)
    if (isNaN(scheduleDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid scheduledFor date format. Use ISO 8601 format.' },
        { status: 400 }
      )
    }

    if (scheduleDate <= new Date()) {
      return NextResponse.json(
        { error: 'Scheduled date must be in the future' },
        { status: 400 }
      )
    }

    // Salva nel database
    const savedPost = await saveScheduledPost({
      userId: session.user.id,
      socialAccountId,
      accountUuid,
      caption: caption || 'Scheduled post',
      postType: postType || 'reel',
      videoUrls,
      videoFilenames,
      videoSizes,
      scheduledFor: scheduleDate,
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
