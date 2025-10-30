/**
 * Smart Scheduling API
 * 
 * NUOVO FLUSSO (2025-10-30):
 * - TUTTI i video vengono salvati SOLO nel database Neon con status PENDING
 * - NIENTE viene mai caricato su OnlySocial in questa fase
 * - Il cron job /api/cron/pre-upload si occuperà di caricare i video 1 ora prima
 * - Il cron job /api/cron/publish si occuperà della pubblicazione immediata all'ora esatta
 * 
 * Questo endpoint è chiamato dall'interfaccia utente quando si clicca "Schedula Tutti"
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface ScheduleVideoRequest {
  socialAccountId: string
  videoUrl: string // URL su DigitalOcean Spaces
  videoFilename: string
  videoSize: number // bytes
  caption: string
  postType: 'reel' | 'story' | 'post'
  // Data/ora GIÀ IN UTC! Il frontend ha già fatto la conversione
  scheduledFor: string // ISO 8601 UTC string
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verifica autenticazione
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Ottieni l'utente dal database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // 3. Parse request body
    const videos: ScheduleVideoRequest[] = await request.json()
    
    console.log(`📅 Saving ${videos.length} videos to database for user ${user.email}`)

    interface SavedVideo {
      id: string
      filename: string
      scheduledFor: string
      willBeUploadedAt: string // 1 ora prima della pubblicazione
    }

    interface VideoError {
      filename: string
      error: string
    }

    const results = {
      saved: [] as SavedVideo[],
      errors: [] as VideoError[]
    }

    // 4. Salva TUTTI i video nel database con status PENDING
    for (const video of videos) {
      try {
        console.log(`� Saving video to database: ${video.videoFilename}`)
        
        // Ottieni l'account social
        const socialAccount = await prisma.socialAccount.findUnique({
          where: { id: video.socialAccountId }
        })
        
        if (!socialAccount) {
          throw new Error(`Social account ${video.socialAccountId} not found`)
        }
        
        // La data è già in UTC
        const scheduledDateUTC = new Date(video.scheduledFor)
        
        // Calcola quando il video verrà pre-caricato (1 ora prima)
        const willBeUploadedAt = new Date(scheduledDateUTC.getTime() - 60 * 60 * 1000)
        
        console.log(`   Scheduled for (UTC): ${scheduledDateUTC.toISOString()}`)
        console.log(`   Will be uploaded at (UTC): ${willBeUploadedAt.toISOString()}`)
        
        // Salva nel database con status PENDING
        const scheduledPost = await prisma.scheduledPost.create({
          data: {
            userId: user.id,
            socialAccountId: video.socialAccountId,
            accountUuid: socialAccount.accountId, // UUID account OnlySocial
            videoUrls: [video.videoUrl],
            videoFilenames: [video.videoFilename],
            videoSizes: [video.videoSize],
            caption: video.caption,
            postType: video.postType,
            scheduledFor: scheduledDateUTC,
            timezone: user.timezone || 'Europe/Rome',
            status: 'PENDING', // Video salvato, non ancora caricato su OnlySocial
            preUploaded: false
          }
        })
        
        console.log(`   ✅ Saved to database with ID: ${scheduledPost.id}`)
        
        results.saved.push({
          id: scheduledPost.id,
          filename: video.videoFilename,
          scheduledFor: video.scheduledFor,
          willBeUploadedAt: willBeUploadedAt.toISOString()
        })
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`❌ Error saving video ${video.videoFilename}:`, error)
        results.errors.push({
          filename: video.videoFilename,
          error: errorMessage
        })
      }
    }

    // 5. Ritorna risultati
    console.log(`✅ Scheduling completed`)
    console.log(`   - Saved: ${results.saved.length}`)
    console.log(`   - Errors: ${results.errors.length}`)

    return NextResponse.json({
      success: true,
      summary: {
        total: videos.length,
        saved: results.saved.length,
        errors: results.errors.length
      },
      results,
      message: 'Videos saved successfully. They will be uploaded 1 hour before publication and published at the scheduled time by cron jobs.'
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    console.error('❌ Smart scheduling error:', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
