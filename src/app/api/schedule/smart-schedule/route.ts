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
  scheduledFor: string // ISO date string
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
    const now = new Date()
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000) // +1 ora
    
    const videosToUploadNow: ScheduleVideoRequest[] = []
    const videosToUploadLater: ScheduleVideoRequest[] = []
    
    for (const video of videos) {
      const scheduledDate = new Date(video.scheduledFor)
      
      if (scheduledDate <= oneHourFromNow) {
        // Pubblica entro 1 ora → carica su OnlySocial ORA
        videosToUploadNow.push(video)
      } else {
        // Pubblica tra più di 1 ora → salva per dopo
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

    const results = {
      uploadedNow: [] as any[],
      savedForLater: [] as any[],
      errors: [] as any[]
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
        
        const mediaData = mediaResult.data as any
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
        const scheduledDate = new Date(video.scheduledFor)
        const year = scheduledDate.getFullYear()
        const month = scheduledDate.getMonth() + 1 // JS months are 0-indexed
        const day = scheduledDate.getDate()
        const hour = scheduledDate.getHours()
        const minute = scheduledDate.getMinutes()
        
        const postResult = await onlySocialApi.createAndSchedulePost(
          video.socialAccountId, // account UUID
          video.caption,
          [mediaData.url],
          year,
          month,
          day,
          hour,
          minute,
          video.postType
        )
        
        const postId = postResult.postUuid
        
        console.log(`✅ Post scheduled on OnlySocial, UUID: ${postId}`)
        
        // Step 4: Salva nel database
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
            scheduledFor: scheduledDate,
            status: 'SCHEDULED',
            uploadedToOSAt: new Date(),
            scheduledAt: new Date()
          }
        })
        
        results.uploadedNow.push({
          id: scheduledPost.id,
          filename: video.videoFilename,
          scheduledFor: video.scheduledFor,
          onlySocialMediaId: mediaId,
          onlySocialPostId: postId
        })
        
      } catch (error: any) {
        console.error(`❌ Error processing video ${video.videoFilename}:`, error)
        
        // Salva nel database con stato FAILED
        await prisma.scheduledPost.create({
          data: {
            userId: user.id,
            socialAccountId: video.socialAccountId,
            videoUrl: video.videoUrl,
            videoFilename: video.videoFilename,
            videoSize: video.videoSize,
            caption: video.caption,
            postType: video.postType,
            scheduledFor: new Date(video.scheduledFor),
            status: 'FAILED',
            errorMessage: error.message
          }
        })
        
        results.errors.push({
          filename: video.videoFilename,
          error: error.message
        })
      }
    }

    // 7. Salva video da caricare DOPO
    for (const video of videosToUploadLater) {
      try {
        console.log(`💾 Saving video for later upload: ${video.videoFilename}`)
        
        const scheduledPost = await prisma.scheduledPost.create({
          data: {
            userId: user.id,
            socialAccountId: video.socialAccountId,
            videoUrl: video.videoUrl,
            videoFilename: video.videoFilename,
            videoSize: video.videoSize,
            caption: video.caption,
            postType: video.postType,
            scheduledFor: new Date(video.scheduledFor),
            status: 'VIDEO_UPLOADED_DO' // Video su DigitalOcean, non ancora su OnlySocial
          }
        })
        
        results.savedForLater.push({
          id: scheduledPost.id,
          filename: video.videoFilename,
          scheduledFor: video.scheduledFor,
          willUploadAt: new Date(new Date(video.scheduledFor).getTime() - 60 * 60 * 1000).toISOString()
        })
        
      } catch (error: any) {
        console.error(`❌ Error saving video ${video.videoFilename}:`, error)
        results.errors.push({
          filename: video.videoFilename,
          error: error.message
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

  } catch (error: any) {
    console.error('❌ Smart scheduling error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
