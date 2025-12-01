/**
 * Neon Database Utilities
 * Funzioni per gestire scheduled posts con Prisma
 * 
 * IMPORTANTE: Tutti gli orari sono in formato italiano (Europe/Rome, UTC+1)
 * - scheduledFor: Data/ora in formato italiano
 * - publishedAt: Data/ora in formato italiano
 * - createdAt/updatedAt: Data/ora in formato italiano
 * 
 * OnlySocial API utilizza lo stesso fuso orario italiano impostato nella dashboard
 * 
 * Updated: 2025-12-01
 */

import { prisma } from '@/lib/prisma'
import { PostStatus, Prisma } from '@prisma/client'

export interface SaveScheduledPostData {
  userId: string
  socialAccountId: string
  accountUuid?: string  // UUID OnlySocial API
  accountId?: number     // ID numerico OnlySocial API
  caption: string
  postType?: string
  videoUrls: string[]
  videoFilenames: string[]
  videoSizes: number[]
  scheduledFor: Date     // Data/ora in formato italiano (Europe/Rome)
  timezone?: string      // Default: 'Europe/Rome'
}

/**
 * Salva un post programmato nel database
 */
export async function saveScheduledPost(data: SaveScheduledPostData) {
  // Crea timestamp italiani (aggiungiamo +1 ora per compensare conversione UTC di PostgreSQL)
  const now = new Date()
  const italianTime = new Date(now.getTime() + (60 * 60 * 1000)) // +1 ora

  const result = await prisma.scheduledPost.create({
    data: {
      userId: data.userId,
      socialAccountId: data.socialAccountId,
      accountUuid: data.accountUuid,
      accountId: data.accountId,
      caption: data.caption,
      postType: data.postType || 'reel',
      videoUrls: data.videoUrls,
      videoFilenames: data.videoFilenames,
      videoSizes: data.videoSizes,
      scheduledFor: data.scheduledFor,
      timezone: data.timezone || 'Europe/Rome',
      status: PostStatus.PENDING,
      createdAt: italianTime,  // Imposta manualmente con orario italiano
      updatedAt: italianTime,  // Imposta manualmente con orario italiano
    },
    select: {
      id: true,
      scheduledFor: true,
    },
  })

  return result
}

/**
 * Marca post come pubblicato con successo
 */
export async function markPostAsPublished(postId: string) {
  const now = new Date()
  const italianTime = new Date(now.getTime() + (60 * 60 * 1000)) // +1 ora
  
  await prisma.scheduledPost.update({
    where: { id: postId },
    data: {
      status: PostStatus.PUBLISHED,
      publishedAt: italianTime,
      updatedAt: italianTime,
    },
  })
}

/**
 * Marca post come fallito con messaggio di errore
 */
export async function markPostAsFailed(postId: string, errorMessage: string) {
  const now = new Date()
  const italianTime = new Date(now.getTime() + (60 * 60 * 1000)) // +1 ora
  
  await prisma.scheduledPost.update({
    where: { id: postId },
    data: {
      status: PostStatus.FAILED,
      errorMessage: errorMessage,
      retryCount: { increment: 1 },
      updatedAt: italianTime,
    },
  })
}

/**
 * Cancella un post programmato (soft delete)
 */
export async function cancelScheduledPost(postId: string, userId: string) {
  // Verifica che il post appartenga all'utente
  const post = await prisma.scheduledPost.findFirst({
    where: {
      id: postId,
      userId: userId,
    },
  })

  if (!post) {
    throw new Error('Post not found or unauthorized')
  }

  // Non può cancellare se già pubblicato
  if (post.status === PostStatus.PUBLISHED) {
    throw new Error('Cannot cancel published post')
  }

  const now = new Date()
  const italianTime = new Date(now.getTime() + (60 * 60 * 1000)) // +1 ora

  await prisma.scheduledPost.update({
    where: { id: postId },
    data: {
      status: PostStatus.CANCELLED,
      updatedAt: italianTime,
    },
  })
}

/**
 * Lista post programmati per un utente
 */
export async function listScheduledPosts(
  userId: string,
  filters?: {
    status?: PostStatus
    fromDate?: Date
    toDate?: Date
  }
) {
  const where: Prisma.ScheduledPostWhereInput = { userId }

  if (filters?.status) {
    where.status = filters.status
  }

  if (filters?.fromDate || filters?.toDate) {
    where.scheduledFor = {}
    if (filters.fromDate) {
      where.scheduledFor.gte = filters.fromDate
    }
    if (filters.toDate) {
      where.scheduledFor.lte = filters.toDate
    }
  }

  const posts = await prisma.scheduledPost.findMany({
    where,
    orderBy: {
      scheduledFor: 'desc',
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  })

  return posts
}

/**
 * Ottieni statistiche post programmati per un utente
 */
export async function getScheduledPostsStats(userId: string) {
  const [total, pending, published, failed] = await Promise.all([
    prisma.scheduledPost.count({ where: { userId } }),
    prisma.scheduledPost.count({ where: { userId, status: PostStatus.PENDING } }),
    prisma.scheduledPost.count({ where: { userId, status: PostStatus.PUBLISHED } }),
    prisma.scheduledPost.count({ where: { userId, status: PostStatus.FAILED } }),
  ])

  return {
    total,
    pending,
    published,
    failed,
  }
}
