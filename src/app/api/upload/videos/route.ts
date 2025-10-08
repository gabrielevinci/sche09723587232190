/**
 * API Route: Upload Videos to DigitalOcean Spaces
 * POST /api/upload/videos
 * 
 * Carica video su DigitalOcean Spaces con struttura:
 * /userId/profileId/timestamp/filename.mp4
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DOSpacesAPI } from '@/lib/digitalocean-spaces'
import { prisma } from '@/lib/prisma'

// Configurazione per upload di file grandi
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minuti
// Aumenta il limite del body per video grandi (50MB)
export const bodyParser = false
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
}

interface UploadedVideo {
  fileName: string
  url: string
  size: number
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

    // Parse multipart form data
    const formData = await request.formData()
    const profileId = formData.get('profileId') as string
    
    if (!profileId) {
      return NextResponse.json(
        { error: 'Profile ID mancante' },
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

    // Configura DigitalOcean Spaces client
    const spacesConfig = {
      endpoint: process.env.DO_SPACES_ENDPOINT || 'https://lon1.digitaloceanspaces.com',
      region: process.env.DO_SPACES_REGION || 'lon1',
      accessKeyId: process.env.DO_SPACES_KEY || '',
      secretAccessKey: process.env.DO_SPACES_SECRET || '',
      bucket: process.env.DO_SPACES_BUCKET || 'scheduler-0chiacchiere',
    }

    // Verifica configurazione
    if (!spacesConfig.accessKeyId || !spacesConfig.secretAccessKey) {
      return NextResponse.json(
        { error: 'DigitalOcean Spaces non configurato' },
        { status: 500 }
      )
    }

    const spacesAPI = new DOSpacesAPI(spacesConfig)

    // Crea timestamp per questa sessione di upload
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    
    // Array per tracking degli upload
    const uploadedVideos: UploadedVideo[] = []
    const errors: string[] = []

    // Processa ogni file caricato
    const files = formData.getAll('videos')
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      if (!(file instanceof File)) {
        errors.push(`File ${i}: Formato non valido`)
        continue
      }

      try {
        // Leggi il file come buffer
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Costruisci il path: userId/profileId/timestamp/filename
        const filePath = `${user.id}/${profileId}/${timestamp}/${file.name}`
        
        // Upload su DigitalOcean Spaces
        const url = await spacesAPI.uploadFile(
          filePath,
          buffer,
          file.type || 'video/mp4'
        )

        uploadedVideos.push({
          fileName: file.name,
          url,
          size: buffer.length,
        })

        console.log(`✓ Uploaded: ${file.name} -> ${url}`)
      } catch (error) {
        console.error(`✗ Error uploading ${file.name}:`, error)
        errors.push(`File ${file.name}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`)
      }
    }

    // Risposta
    return NextResponse.json({
      success: true,
      uploaded: uploadedVideos.length,
      total: files.length,
      videos: uploadedVideos,
      errors: errors.length > 0 ? errors : undefined,
      uploadPath: `${user.id}/${profileId}/${timestamp}`,
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { 
        error: 'Errore durante l\'upload',
        details: error instanceof Error ? error.message : 'Errore sconosciuto'
      },
      { status: 500 }
    )
  }
}
