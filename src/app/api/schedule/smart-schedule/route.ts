/**
 * Smart Scheduling API
 * 
 * Gestisce lo scheduling intelligente dei video:
 * - Video da pubblicare entro 1 ora: carica su DigitalOcean + OnlySocial + schedula
 * - Video da pubblicare dopo 1 ora: carica solo su DigitalOcean, schedula per dopo
 * 
 * Questo endpoint è chiamato dall'interfaccia utente quando si clicca "Schedula Tutti"
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { OnlySocialAPI } from '@/lib/onlysocial-api'

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
    
    console.log(`📅 Smart scheduling ${videos.length} videos for user ${user.email}`)

    // 4. Determina quali video caricare ora e quali dopo
    // Le date sono GIÀ IN UTC, confronto diretto!
    const now = new Date()
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000) // +1 ora
    
    const videosToUploadNow: ScheduleVideoRequest[] = []
    const videosToUploadLater: ScheduleVideoRequest[] = []
    
    for (const video of videos) {
      // scheduledFor è GIÀ UTC! No conversione necessaria
      const scheduledDateUTC = new Date(video.scheduledFor)
      
      console.log(`📅 Video: ${video.videoFilename}`)
      console.log(`   Scheduled (UTC): ${scheduledDateUTC.toISOString()}`)
      console.log(`   Now (UTC): ${now.toISOString()}`)
      console.log(`   One hour from now (UTC): ${oneHourFromNow.toISOString()}`)
      
      if (scheduledDateUTC <= oneHourFromNow) {
        // Pubblica entro 1 ora → carica su OnlySocial ORA
        console.log(`   ✅ Upload NOW`)
        videosToUploadNow.push(video)
      } else {
        // Pubblica tra più di 1 ora → salva per dopo
        console.log(`   ⏰ Upload LATER`)
        videosToUploadLater.push(video)
      }
    }
    
    console.log(`⚡ ${videosToUploadNow.length} videos to upload NOW`)
    console.log(`⏰ ${videosToUploadLater.length} videos to upload LATER`)

    // 5. Inizializza OnlySocial API
    const onlySocialToken = process.env.ONLYSOCIAL_API_KEY
    const workspaceUuid = process.env.ONLYSOCIAL_WORKSPACE_UUID

    if (!onlySocialToken || !workspaceUuid) {
      throw new Error('OnlySocial credentials not configured')
    }

    const onlySocialApi = new OnlySocialAPI({
      token: onlySocialToken,
      workspaceUuid: workspaceUuid
    })

    interface UploadedVideo {
      id: string
      filename: string
      scheduledFor: string
      onlySocialMediaId?: string
      onlySocialPostId?: string
      willUploadAt?: string
    }

    interface VideoError {
      filename: string
      error: string
    }

    const results = {
      uploadedNow: [] as UploadedVideo[],
      savedForLater: [] as UploadedVideo[],
      errors: [] as VideoError[]
    }

    // 6. Processa video da caricare ORA
    for (const video of videosToUploadNow) {
      try {
        console.log(`🚀 Processing video for immediate upload: ${video.videoFilename}`)
        
        // Step 1: Carica video su OnlySocial
        const mediaResult = await onlySocialApi.uploadMedia({
          file: video.videoUrl,
          alt_text: video.caption
        })
        
        interface MediaData {
          id?: number
          uuid?: string
          url: string
        }
        
        const mediaData = (mediaResult as { data: MediaData }).data
        const mediaId = mediaData.id || mediaData.uuid
        
        console.log(`✅ Video uploaded to OnlySocial, ID: ${mediaId}`)
        
        // Step 2: Ottieni account OnlySocial ID
        const socialAccount = await prisma.socialAccount.findUnique({
          where: { id: video.socialAccountId }
        })
        
        if (!socialAccount) {
          throw new Error(`Social account ${video.socialAccountId} not found`)
        }
        
        // Step 3: Schedula post su OnlySocial
        // video.scheduledFor è GIÀ IN UTC! Estraiamo i componenti direttamente
        const scheduledDateUTC = new Date(video.scheduledFor)
        
        // Estrai componenti UTC per OnlySocial API
        const yearUTC = scheduledDateUTC.getUTCFullYear()
        const monthUTC = scheduledDateUTC.getUTCMonth() + 1
        const dayUTC = scheduledDateUTC.getUTCDate()
        const hourUTC = scheduledDateUTC.getUTCHours()
        const minuteUTC = scheduledDateUTC.getUTCMinutes()
        
        console.log(`📝 Creating post for account ID: ${socialAccount.accountId}`)
        console.log(`⏰ Scheduled for (UTC): ${scheduledDateUTC.toISOString()}`)
        console.log(`⏰ OnlySocial format: ${yearUTC}-${monthUTC}-${dayUTC} ${hourUTC}:${minuteUTC}`)
        
        // ✅ Usa il media ID già caricato, NON ri-caricare il video
        const mediaIdNumber = typeof mediaId === 'string' ? parseInt(mediaId, 10) : mediaId as number
        
        const postResult = await onlySocialApi.createAndSchedulePostWithMediaIds(
          socialAccount.accountId, // UUID dell'account OnlySocial
          video.caption,
          [mediaIdNumber], // Array di ID dei media già caricati
          yearUTC,  // Componenti UTC
          monthUTC,
          dayUTC,
          hourUTC,
          minuteUTC,
          video.postType
        )
        
        const postId = postResult.postUuid
        
        console.log(`✅ Post scheduled on OnlySocial, UUID: ${postId}`)
        
        // Step 4: Salva nel database (già UTC!)
        const scheduledPost = await prisma.scheduledPost.create({
          data: {
            userId: user.id,
            socialAccountId: video.socialAccountId,
            videoUrl: video.videoUrl,
            videoFilename: video.videoFilename,
            videoSize: video.videoSize,
            onlySocialMediaId: String(mediaId),
            onlySocialPostId: String(postId),
            onlySocialMediaUrl: mediaData.url,
            caption: video.caption,
            postType: video.postType,
            scheduledFor: scheduledDateUTC, // GIÀ UTC!
            status: 'SCHEDULED',
            uploadedToOSAt: new Date(),
            scheduledAt: new Date()
          }
        })
        
        results.uploadedNow.push({
          id: scheduledPost.id,
          filename: video.videoFilename,
          scheduledFor: video.scheduledFor, // ISO string UTC
          onlySocialMediaId: String(mediaId),
          onlySocialPostId: postId
        })
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`❌ Error processing video ${video.videoFilename}:`, error)
        
        // Salva nel database con stato FAILED
        const scheduledDateUTC = new Date(video.scheduledFor)
        await prisma.scheduledPost.create({
          data: {
            userId: user.id,
            socialAccountId: video.socialAccountId,
            videoUrl: video.videoUrl,
            videoFilename: video.videoFilename,
            videoSize: video.videoSize,
            caption: video.caption,
            postType: video.postType,
            scheduledFor: scheduledDateUTC,
            status: 'FAILED',
            errorMessage: errorMessage
          }
        })
        
        results.errors.push({
          filename: video.videoFilename,
          error: errorMessage
        })
      }
    }

    // 7. Salva video da caricare DOPO
    for (const video of videosToUploadLater) {
      try {
        console.log(`💾 Saving video for later upload: ${video.videoFilename}`)
        
        const scheduledDateUTC = new Date(video.scheduledFor)
        const willUploadAt = new Date(scheduledDateUTC.getTime() - 60 * 60 * 1000) // 1 ora prima
        
        const scheduledPost = await prisma.scheduledPost.create({
          data: {
            userId: user.id,
            socialAccountId: video.socialAccountId,
            videoUrl: video.videoUrl,
            videoFilename: video.videoFilename,
            videoSize: video.videoSize,
            caption: video.caption,
            postType: video.postType,
            scheduledFor: scheduledDateUTC, // GIÀ UTC!
            status: 'VIDEO_UPLOADED_DO' // Video su DigitalOcean, non ancora su OnlySocial
          }
        })
        
        results.savedForLater.push({
          id: scheduledPost.id,
          filename: video.videoFilename,
          scheduledFor: video.scheduledFor, // ISO string UTC
          willUploadAt: willUploadAt.toISOString()
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

    // 8. Ritorna risultati
    console.log(`✅ Smart scheduling completed`)
    console.log(`   - Uploaded NOW: ${results.uploadedNow.length}`)
    console.log(`   - Saved for LATER: ${results.savedForLater.length}`)
    console.log(`   - Errors: ${results.errors.length}`)

    return NextResponse.json({
      success: true,
      summary: {
        total: videos.length,
        uploadedNow: results.uploadedNow.length,
        savedForLater: results.savedForLater.length,
        errors: results.errors.length
      },
      results
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
