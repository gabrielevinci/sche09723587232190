/**
 * API Route: Schedule Posts on OnlySocial
 * POST /api/schedule/posts
 * 
 * Riceve dati dal drawer e crea/schedula post su OnlySocial
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { OnlySocialAPI } from '@/lib/onlysocial-api'
import { prisma } from '@/lib/prisma'

export const maxDuration = 300 // 5 minuti

interface ScheduleRequest {
  profileId: string
  accountUuid: string
  posts: Array<{
    videoUrl: string
    caption: string
    year: number
    month: number
    day: number
    hour: number
    minute: number
    postType: string
  }>
}

export async function POST(request: NextRequest) {
  try {
    // Autenticazione
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      )
    }

    // Trova utente nel database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, isActive: true },
    })

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Utente non attivo' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json() as ScheduleRequest

    const { profileId, accountUuid, posts } = body

    if (!profileId || !accountUuid || !posts || posts.length === 0) {
      return NextResponse.json(
        { error: 'Dati mancanti' },
        { status: 400 }
      )
    }

    // Verifica che il profilo sia assegnato all'utente
    const association = await prisma.adminAssociation.findFirst({
      where: {
        userId: user.id,
        socialAccountId: profileId,
      },
      include: {
        socialAccount: true,
      },
    })

    if (!association) {
      return NextResponse.json(
        { error: 'Profilo non autorizzato' },
        { status: 403 }
      )
    }

    // Configura OnlySocial API
    const onlySocialAPI = new OnlySocialAPI({
      token: process.env.ONLYSOCIAL_API_KEY || '',
      workspaceUuid: process.env.ONLYSOCIAL_WORKSPACE_UUID || '',
    })

    // Array per tracking dei post schedulati
    const scheduledPosts: Array<{
      videoUrl: string
      postUuid: string
      scheduledAt: string
      status: 'success' | 'error'
      error?: string
    }> = []

    // Processa ogni post
    for (const post of posts) {
      try {
        console.log(`Scheduling post for video: ${post.videoUrl}`)
        console.log(`  Caption: ${post.caption.substring(0, 50)}...`)
        console.log(`  Date: ${post.year}-${post.month}-${post.day} ${post.hour}:${post.minute}`)
        console.log(`  Type: ${post.postType}`)

        // Crea e schedula il post su OnlySocial
        const result = await onlySocialAPI.createAndSchedulePost(
          accountUuid,
          post.caption,
          [post.videoUrl], // Array con un singolo video
          post.year,
          post.month,
          post.day,
          post.hour,
          post.minute,
          post.postType
        )

        scheduledPosts.push({
          videoUrl: post.videoUrl,
          postUuid: result.postUuid,
          scheduledAt: result.scheduledAt,
          status: 'success',
        })

        console.log(`✓ Post scheduled: ${result.postUuid}`)
      } catch (error) {
        console.error(`✗ Error scheduling post for ${post.videoUrl}:`, error)
        
        scheduledPosts.push({
          videoUrl: post.videoUrl,
          postUuid: '',
          scheduledAt: '',
          status: 'error',
          error: error instanceof Error ? error.message : 'Errore sconosciuto',
        })
      }
    }

    // Conta successi ed errori
    const successCount = scheduledPosts.filter(p => p.status === 'success').length
    const errorCount = scheduledPosts.filter(p => p.status === 'error').length

    console.log(`\n=== Scheduling Summary ===`)
    console.log(`Total: ${posts.length}`)
    console.log(`Success: ${successCount}`)
    console.log(`Errors: ${errorCount}`)

    // Risposta
    return NextResponse.json({
      success: errorCount === 0,
      total: posts.length,
      scheduled: successCount,
      errors: errorCount,
      posts: scheduledPosts,
      message: errorCount === 0 
        ? `Tutti i ${successCount} post sono stati schedulati con successo!`
        : `${successCount} post schedulati, ${errorCount} errori.`
    })

  } catch (error) {
    console.error('Schedule posts error:', error)
    return NextResponse.json(
      { 
        error: 'Errore durante lo scheduling dei post',
        details: error instanceof Error ? error.message : 'Errore sconosciuto'
      },
      { status: 500 }
    )
  }
}
