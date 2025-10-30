/**
 * Neon Database Utilities
 * Funzioni per gestire scheduled posts con Prisma
 * Updated: 2025-10-30
 */

import { prisma } from '@/lib/prisma'
import { PostStatus, Prisma } from '@prisma/client'

export interface SaveScheduledPostData {
  userId: string
  socialAccountId: string
  accountUuid: string
  caption: string
  postType?: string
  videoUrls: string[]
  videoFilenames: string[]
  videoSizes: number[]
  scheduledFor: Date
  timezone?: string
}

/**
 * Salva un post programmato nel database
 */
export async function saveScheduledPost(data: SaveScheduledPostData) {
  const result = await prisma.scheduledPost.create({
    data: {
      userId: data.userId,
      socialAccountId: data.socialAccountId,
      accountUuid: data.accountUuid,
      caption: data.caption,
      postType: data.postType || 'reel',
      videoUrls: data.videoUrls,
      videoFilenames: data.videoFilenames,
      videoSizes: data.videoSizes,
      scheduledFor: data.scheduledFor,
      timezone: data.timezone || 'Europe/Rome',
      status: PostStatus.PENDING,
    },
    select: {
      id: true,
      scheduledFor: true,
    },
  })

  return result
}

/**
 * Trova post da pre-caricare (da pubblicare nelle prossime X ore)
 * Filtra solo post in stato PENDING che non sono stati pre-caricati
 * 
 * IMPORTANTE: Include anche post "in ritardo" (scheduledFor nel passato)
 * per recuperare eventuali post saltati dal cron job precedente
 */
export async function getPostsDueForPreUpload(hoursAhead: number = 2) {
  const futureDate = new Date()
  futureDate.setHours(futureDate.getHours() + hoursAhead)

  const posts = await prisma.scheduledPost.findMany({
    where: {
      status: PostStatus.PENDING,
      preUploaded: false,
      scheduledFor: {
        lte: futureDate,
        // RIMOSSO gt: new Date() per includere post nel passato che devono ancora essere caricati
      },
    },
    orderBy: {
      scheduledFor: 'asc',
    },
  })

  return posts
}

/**
 * Trova post da pubblicare ORA (con finestra di tolleranza)
 * Filtra post in stato MEDIA_UPLOADED nell'intervallo temporale
 * 
 * IMPORTANTE: Usa una finestra estesa nel passato per recuperare post "in ritardo"
 * che non sono stati pubblicati al momento giusto (es. cron job saltato)
 */
export async function getPostsDueForPublishing(minutesWindow: number = 5) {
  const now = new Date()
  // Finestra estesa nel passato (30 minuti) per recuperare post in ritardo
  const past = new Date(now.getTime() - 30 * 60000)
  // Finestra normale nel futuro (minutesWindow)
  const future = new Date(now.getTime() + minutesWindow * 60000)

  const posts = await prisma.scheduledPost.findMany({
    where: {
      status: PostStatus.MEDIA_UPLOADED,
      scheduledFor: {
        gte: past,
        lte: future,
      },
    },
    orderBy: {
      scheduledFor: 'asc',
    },
  })

  return posts
}

/**
 * Aggiorna post dopo il pre-upload dei video
 */
export async function updatePostMediaIds(
  postId: string,
  mediaIds: string[],
  postUuid: string | null = null,
  accountId: number | null = null
) {
  await prisma.scheduledPost.update({
    where: { id: postId },
    data: {
      onlySocialMediaIds: mediaIds,
      onlySocialPostUuid: postUuid,
      accountId: accountId,
      preUploaded: true,
      preUploadAt: new Date(),
      status: PostStatus.MEDIA_UPLOADED,
      updatedAt: new Date(),
    },
  })
}

/**
 * Marca post come pubblicato con successo
 */
export async function markPostAsPublished(postId: string) {
  await prisma.scheduledPost.update({
    where: { id: postId },
    data: {
      status: PostStatus.PUBLISHED,
      publishedAt: new Date(),
      updatedAt: new Date(),
    },
  })
}

/**
 * Marca post come fallito con messaggio di errore
 */
export async function markPostAsFailed(postId: string, errorMessage: string) {
  await prisma.scheduledPost.update({
    where: { id: postId },
    data: {
      status: PostStatus.FAILED,
      errorMessage: errorMessage,
      retryCount: { increment: 1 },
      updatedAt: new Date(),
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

  await prisma.scheduledPost.update({
    where: { id: postId },
    data: {
      status: PostStatus.CANCELLED,
      updatedAt: new Date(),
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
  const [total, pending, mediaUploaded, published, failed] = await Promise.all([
    prisma.scheduledPost.count({ where: { userId } }),
    prisma.scheduledPost.count({ where: { userId, status: PostStatus.PENDING } }),
    prisma.scheduledPost.count({ where: { userId, status: PostStatus.MEDIA_UPLOADED } }),
    prisma.scheduledPost.count({ where: { userId, status: PostStatus.PUBLISHED } }),
    prisma.scheduledPost.count({ where: { userId, status: PostStatus.FAILED } }),
  ])

  return {
    total,
    pending,
    mediaUploaded,
    published,
    failed,
  }
}
