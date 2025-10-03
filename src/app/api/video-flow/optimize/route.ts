import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { VideoFlowService } from '@/lib/video-flow-service'

export async function POST(request: NextRequest) {
  try {
    // Verifica autenticazione admin (dovresti implementare un controllo per admin)
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    // Verifica che l'utente sia admin
    // if (!session.user.isAdmin) {
    //   return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    // }

    const videoFlowService = new VideoFlowService({
      onlySocial: {
        token: process.env.ONLYSOCIAL_API_KEY!,
        workspaceUuid: process.env.ONLYSOCIAL_WORKSPACE_UUID!
      },
      digitalOcean: {
        endpoint: process.env.DO_SPACES_ENDPOINT!,
        region: process.env.DO_SPACES_REGION!,
        accessKeyId: process.env.DO_SPACES_ACCESS_KEY!,
        secretAccessKey: process.env.DO_SPACES_SECRET_KEY!,
        bucket: process.env.DO_SPACES_BUCKET!
      }
    })

    const result = await videoFlowService.optimizeOnlySocialStorage()

    return NextResponse.json({
      success: true,
      message: 'Ottimizzazione completata',
      result
    })
  } catch (error) {
    console.error('Error optimizing OnlySocial storage:', error)
    return NextResponse.json(
      { error: 'Errore durante l\'ottimizzazione' },
      { status: 500 }
    )
  }
}
