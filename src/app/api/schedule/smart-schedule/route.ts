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
import { fromZonedTime } from 'date-fns-tz'

interface ScheduleVideoRequest {
  socialAccountId: string
  videoUrl: string // URL su DigitalOcean Spaces
  videoFilename: string
  videoSize: number // bytes
  caption: string
  postType: 'reel' | 'story' | 'post'
  // Componenti data/ora in ora locale italiana (NO UTC)
  year: number
  month: number
  day: number
  hour: number
  minute: number
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
    // IMPORTANTE: Il server Vercel è in UTC, ma gli utenti schedulano in ora italiana
    const now = new Date() // UTC
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000) // +1 ora in UTC
    
    const videosToUploadNow: ScheduleVideoRequest[] = []
    const videosToUploadLater: ScheduleVideoRequest[] = []
    
    for (const video of videos) {
      // Crea data in ora locale italiana e convertila in UTC per il confronto
      // fromZonedTime interpreta i componenti come ora di Roma e restituisce l'equivalente UTC
      const scheduledDateLocal = new Date(video.year, video.month - 1, video.day, video.hour, video.minute)
      const scheduledDateUTC = fromZonedTime(scheduledDateLocal, 'Europe/Rome')
      
      console.log(`📅 Video: ${video.videoFilename}`)
      console.log(`   Scheduled (local): ${scheduledDateLocal.toISOString()}`)
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
        
        // Step 3: Determina se schedulare o pubblicare immediatamente
        // IMPORTANTE: OnlySocial interpreta scheduleTime come UTC!
        // Dobbiamo convertire l'ora italiana in UTC prima di inviare
        const scheduledDateLocal = new Date(video.year, video.month - 1, video.day, video.hour, video.minute)
        const scheduledDateUTC = fromZonedTime(scheduledDateLocal, 'Europe/Rome')
        
        // Controlla se il tempo schedulato è troppo vicino (< 10 minuti)
        // Per evitare errori "date is in the past" a causa del processing time
        const now = new Date()
        const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000)
        const shouldPublishNow = scheduledDateUTC <= tenMinutesFromNow
        
        console.log(`📝 Creating post for account ID: ${socialAccount.accountId}`)
        console.log(`⏰ Scheduled for (local IT): ${video.year}-${video.month}-${video.day} ${video.hour}:${video.minute}`)
        console.log(`⏰ Scheduled for (UTC): ${scheduledDateUTC.toISOString()}`)
        console.log(`⏰ Now (UTC): ${now.toISOString()}`)
        console.log(`⏰ Time until scheduled: ${Math.round((scheduledDateUTC.getTime() - now.getTime()) / 1000 / 60)} minutes`)
        
        // ✅ Usa il media ID già caricato, NON ri-caricare il video
        const mediaIdNumber = typeof mediaId === 'string' ? parseInt(mediaId, 10) : mediaId as number
        
        let postId: string
        
        if (shouldPublishNow) {
          // PUBBLICA IMMEDIATAMENTE (troppo vicino per schedulare)
          console.log(`🚀 Publishing NOW (too close to schedule safely)`)
          
          const { postUuid } = await onlySocialApi.createPostWithMediaIds(
            socialAccount.accountId,
            video.caption,
            [mediaIdNumber],
            video.postType
          )
          
          postId = postUuid
          
          // Pubblica immediatamente
          await onlySocialApi.publishPostNow(postId)
          console.log(`✅ Post published immediately!`)
          
        } else {
          // SCHEDULA per dopo (abbastanza tempo)
          console.log(`📅 Scheduling for later`)
          
          // Estrai componenti UTC
          const yearUTC = scheduledDateUTC.getUTCFullYear()
          const monthUTC = scheduledDateUTC.getUTCMonth() + 1
          const dayUTC = scheduledDateUTC.getUTCDate()
          const hourUTC = scheduledDateUTC.getUTCHours()
          const minuteUTC = scheduledDateUTC.getUTCMinutes()
          
          const postResult = await onlySocialApi.createAndSchedulePostWithMediaIds(
            socialAccount.accountId,
            video.caption,
            [mediaIdNumber],
            yearUTC,
            monthUTC,
            dayUTC,
            hourUTC,
            minuteUTC,
            video.postType
          )
          
          postId = postResult.postUuid
          console.log(`✅ Post scheduled on OnlySocial, UUID: ${postId}`)
        }
        
        // Step 4: Salva nel database (usa ora locale italiana)
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
            scheduledFor: scheduledDateLocal, // Usa ora locale per il database
            status: 'SCHEDULED',
            uploadedToOSAt: new Date(),
            scheduledAt: new Date()
          }
        })
        
        results.uploadedNow.push({
          id: scheduledPost.id,
          filename: video.videoFilename,
          scheduledFor: `${video.year}-${video.month}-${video.day} ${video.hour}:${video.minute}`,
          onlySocialMediaId: String(mediaId),
          onlySocialPostId: postId
        })
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`❌ Error processing video ${video.videoFilename}:`, error)
        
        // Salva nel database con stato FAILED
        const scheduledDate = new Date(video.year, video.month - 1, video.day, video.hour, video.minute)
        await prisma.scheduledPost.create({
          data: {
            userId: user.id,
            socialAccountId: video.socialAccountId,
            videoUrl: video.videoUrl,
            videoFilename: video.videoFilename,
            videoSize: video.videoSize,
            caption: video.caption,
            postType: video.postType,
            scheduledFor: scheduledDate,
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
        
        const scheduledDate = new Date(video.year, video.month - 1, video.day, video.hour, video.minute)
        const willUploadAt = new Date(scheduledDate.getTime() - 60 * 60 * 1000) // 1 ora prima
        
        const scheduledPost = await prisma.scheduledPost.create({
          data: {
            userId: user.id,
            socialAccountId: video.socialAccountId,
            videoUrl: video.videoUrl,
            videoFilename: video.videoFilename,
            videoSize: video.videoSize,
            caption: video.caption,
            postType: video.postType,
            scheduledFor: scheduledDate,
            status: 'VIDEO_UPLOADED_DO' // Video su DigitalOcean, non ancora su OnlySocial
          }
        })
        
        results.savedForLater.push({
          id: scheduledPost.id,
          filename: video.videoFilename,
          scheduledFor: `${video.year}-${video.month}-${video.day} ${video.hour}:${video.minute}`,
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
