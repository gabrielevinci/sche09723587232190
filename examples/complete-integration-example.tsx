/**
 * 🎬 ESEMPIO COMPLETO END-TO-END
 * Integrazione OnlySocial nel flusso di upload video
 * 
 * Questo esempio mostra il flusso completo:
 * 1. Utente carica video (frontend)
 * 2. Upload a DigitalOcean Spaces
 * 3. Caricamento su OnlySocial
 * 4. Creazione post programmato
 * 5. Salvataggio nel database
 */

// ============================================================================
// FRONTEND COMPONENT - VideoUploadForm.tsx
// ============================================================================

'use client'

import { useState } from 'react'

interface FormData {
  video: File | null
  caption: string
  scheduleDate: string
  scheduleTime: string
  postType: 'reel' | 'story' | 'post'
  accountUuid: string
}

export default function VideoUploadForm() {
  const [formData, setFormData] = useState<FormData>({
    video: null,
    caption: '',
    scheduleDate: '',
    scheduleTime: '',
    postType: 'reel',
    accountUuid: '' // Dovrebbe essere selezionato da una dropdown
  })

  const [status, setStatus] = useState<string>('')
  const [progress, setProgress] = useState<number>(0)
  const [uploading, setUploading] = useState<boolean>(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, video: e.target.files[0] })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.video) {
      alert('Seleziona un video!')
      return
    }

    if (!formData.accountUuid) {
      alert('Seleziona un account OnlySocial!')
      return
    }

    setUploading(true)
    setProgress(0)

    try {
      // ========================================
      // STEP 1: Upload a DigitalOcean Spaces
      // ========================================
      setStatus('📤 Caricamento su DigitalOcean Spaces...')
      setProgress(25)

      const uploadFormData = new FormData()
      uploadFormData.append('video', formData.video)
      uploadFormData.append('profileId', formData.accountUuid)

      const uploadResponse = await fetch('/api/upload/videos', {
        method: 'POST',
        body: uploadFormData
      })

      if (!uploadResponse.ok) {
        throw new Error('Errore nel caricamento su DigitalOcean')
      }

      const uploadResult = await uploadResponse.json()
      const digitalOceanUrl = uploadResult.videos[0].url

      console.log('✅ Video caricato su DigitalOcean:', digitalOceanUrl)
      setStatus('✅ Video caricato su DigitalOcean!')
      setProgress(50)

      // ========================================
      // STEP 2: Crea post programmato su OnlySocial
      // ========================================
      setStatus('📤 Creazione post su OnlySocial...')
      setProgress(75)

      const postResponse = await fetch('/api/onlysocial/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: formData.caption,
          accountUuid: formData.accountUuid,
          digitalOceanUrls: [digitalOceanUrl],
          scheduleDate: formData.scheduleDate,
          scheduleTime: formData.scheduleTime,
          postType: formData.postType
        })
      })

      if (!postResponse.ok) {
        const errorData = await postResponse.json()
        throw new Error(errorData.error || 'Errore nella creazione del post')
      }

      const postResult = await postResponse.json()

      console.log('✅ Post creato su OnlySocial:', postResult.postUuid)
      setStatus('✅ Post programmato con successo!')
      setProgress(90)

      // ========================================
      // STEP 3: Salva nel database locale (opzionale)
      // ========================================
      await fetch('/api/schedule/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          postUuid: postResult.postUuid,
          videoUrl: digitalOceanUrl,
          caption: formData.caption,
          accountUuid: formData.accountUuid,
          scheduledAt: `${formData.scheduleDate} ${formData.scheduleTime}:00`,
          postType: formData.postType
        })
      })

      setProgress(100)
      setStatus(`🎉 Completato! Post UUID: ${postResult.postUuid}`)

      // Reset form
      setTimeout(() => {
        setFormData({
          video: null,
          caption: '',
          scheduleDate: '',
          scheduleTime: '',
          postType: 'reel',
          accountUuid: formData.accountUuid // Mantieni l'account selezionato
        })
        setProgress(0)
        setStatus('')
      }, 3000)

    } catch (error) {
      console.error('❌ Errore:', error)
      const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto'
      setStatus(`❌ Errore: ${errorMessage}`)
      setProgress(0)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Programma Video</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Video Upload */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Video *
          </label>
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            disabled={uploading}
            className="w-full border rounded p-2"
            required
          />
          {formData.video && (
            <p className="text-sm text-gray-600 mt-1">
              {formData.video.name} ({(formData.video.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        {/* Caption */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Didascalia *
          </label>
          <textarea
            value={formData.caption}
            onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
            disabled={uploading}
            className="w-full border rounded p-2 h-24"
            placeholder="Scrivi la didascalia del post..."
            required
          />
        </div>

        {/* Schedule Date */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Data Programmazione *
          </label>
          <input
            type="date"
            value={formData.scheduleDate}
            onChange={(e) => setFormData({ ...formData, scheduleDate: e.target.value })}
            disabled={uploading}
            className="w-full border rounded p-2"
            required
          />
        </div>

        {/* Schedule Time */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Ora Programmazione *
          </label>
          <input
            type="time"
            value={formData.scheduleTime}
            onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
            disabled={uploading}
            className="w-full border rounded p-2"
            required
          />
        </div>

        {/* Post Type */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Tipo Post *
          </label>
          <select
            value={formData.postType}
            onChange={(e) => setFormData({ ...formData, postType: e.target.value as any })}
            disabled={uploading}
            className="w-full border rounded p-2"
            required
          >
            <option value="reel">Reel</option>
            <option value="story">Story</option>
            <option value="post">Post</option>
          </select>
        </div>

        {/* Account UUID */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Account OnlySocial *
          </label>
          <input
            type="text"
            value={formData.accountUuid}
            onChange={(e) => setFormData({ ...formData, accountUuid: e.target.value })}
            disabled={uploading}
            className="w-full border rounded p-2"
            placeholder="UUID dell'account"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Ottieni l'UUID da /api/onlysocial/accounts
          </p>
        </div>

        {/* Status */}
        {status && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm">{status}</p>
            {progress > 0 && (
              <div className="mt-2 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={uploading}
          className={`w-full py-3 px-4 rounded font-medium ${
            uploading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {uploading ? 'Caricamento in corso...' : 'Programma Video'}
        </button>
      </form>
    </div>
  )
}

// ============================================================================
// BACKEND API - /api/schedule/posts/route.ts
// ============================================================================

/*
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
    }

    const body = await request.json()
    const {
      postUuid,
      videoUrl,
      caption,
      accountUuid,
      scheduledAt,
      postType
    } = body

    // Salva nel database
    const scheduledPost = await prisma.scheduledPost.create({
      data: {
        userId: user.id,
        postUuid: postUuid,
        videoUrl: videoUrl,
        caption: caption,
        accountUuid: accountUuid,
        scheduledAt: new Date(scheduledAt),
        postType: postType,
        status: 'scheduled'
      }
    })

    return NextResponse.json({
      success: true,
      scheduledPost
    }, { status: 201 })

  } catch (error) {
    console.error('Error saving scheduled post:', error)
    return NextResponse.json(
      { error: 'Errore nel salvataggio' },
      { status: 500 }
    )
  }
}
*/

// ============================================================================
// DATABASE SCHEMA - prisma/schema.prisma (da aggiungere se non esiste)
// ============================================================================

/*
model ScheduledPost {
  id          String   @id @default(cuid())
  userId      String
  postUuid    String   // UUID del post su OnlySocial
  videoUrl    String   // URL su DigitalOcean
  caption     String   @db.Text
  accountUuid String   // UUID account OnlySocial
  scheduledAt DateTime
  postType    String   // 'reel', 'story', 'post'
  status      String   // 'scheduled', 'published', 'failed'
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([postUuid])
  @@index([status])
  @@index([scheduledAt])
}
*/

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

/*
// In your dashboard page
import VideoUploadForm from '@/components/VideoUploadForm'

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      <VideoUploadForm />
    </div>
  )
}
*/
