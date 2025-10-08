/**
 * API Route: Generate Pre-signed URLs for Direct Upload
 * POST /api/upload/presigned-url
 * 
 * Genera URL firmati per upload diretto da browser a DigitalOcean Spaces
 * Bypassa il limite di 4.5MB di Vercel
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const runtime = 'nodejs'

interface PresignedUrlRequest {
  profileId: string
  fileName: string
  fileSize: number
  fileType: string
  timestamp?: string // Timestamp opzionale per raggruppare file dello stesso batch
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

    // Ottieni dati richiesta
    const body: PresignedUrlRequest = await request.json()
    const { profileId, fileName, fileSize, fileType, timestamp } = body

    if (!profileId || !fileName || !fileSize || !fileType) {
      return NextResponse.json(
        { error: 'Parametri mancanti' },
        { status: 400 }
      )
    }

    // Trova utente
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      )
    }

    // Verifica che l'utente abbia accesso al profilo
    const association = await prisma.adminAssociation.findUnique({
      where: {
        userId_socialAccountId: {
          userId: user.id,
          socialAccountId: profileId,
        },
      },
    })

    if (!association) {
      return NextResponse.json(
        { error: 'Non hai accesso a questo profilo' },
        { status: 403 }
      )
    }

    // Verifica configurazione DigitalOcean
    const endpoint = process.env.DO_SPACES_ENDPOINT
    const region = process.env.DO_SPACES_REGION
    const bucket = process.env.DO_SPACES_BUCKET
    const accessKeyId = process.env.DO_SPACES_KEY
    const secretAccessKey = process.env.DO_SPACES_SECRET

    if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
      console.error('[Presigned URL] Configurazione DigitalOcean mancante')
      return NextResponse.json(
        { error: 'Configurazione storage non completa' },
        { status: 500 }
      )
    }

    // Crea timestamp per cartella (usa quello fornito o creane uno nuovo)
    const folderTimestamp = timestamp || new Date().toISOString().replace(/[:.]/g, '-')
    
    // Costruisci path: userId/profileId/timestamp/filename.mp4
    const key = `${user.id}/${profileId}/${folderTimestamp}/${fileName}`

    // Crea client S3
    const s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })

    // Genera URL firmato (valido per 10 minuti)
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: fileType,
      ACL: 'public-read',
    })

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 600, // 10 minuti
    })

    // URL pubblico del file dopo l'upload
    const publicUrl = `${endpoint}/${bucket}/${key}`

    console.log(`[Presigned URL] Generato URL per ${fileName} (${fileSize} bytes)`)
    console.log(`[Presigned URL] Public URL: ${publicUrl}`)

    return NextResponse.json({
      presignedUrl,
      publicUrl,
      key,
      expiresIn: 600,
    })

  } catch (error) {
    console.error('[Presigned URL] Errore:', error)
    return NextResponse.json(
      { 
        error: 'Errore durante la generazione dell\'URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
