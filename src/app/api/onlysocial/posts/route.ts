import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { OnlySocialAPI } from '@/lib/onlysocial-api'

export async function GET(request: NextRequest) {
  try {
    // Verifica autenticazione
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')

    const token = process.env.ONLYSOCIAL_API_KEY
    const workspaceUuid = process.env.ONLYSOCIAL_WORKSPACE_UUID

    if (!token || !workspaceUuid) {
      return NextResponse.json(
        { error: 'Configurazione OnlySocial mancante' },
        { status: 500 }
      )
    }

    const api = new OnlySocialAPI({ token, workspaceUuid })
    const posts = await api.listPosts(page)

    return NextResponse.json(posts)
  } catch (error) {
    console.error('Error fetching OnlySocial posts:', error)
    return NextResponse.json(
      { error: 'Errore nel recupero dei post' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verifica autenticazione
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json()
    const { content, accountUuid, mediaUrls = [], scheduleDate, scheduleTime, postType } = body

    if (!content || !accountUuid) {
      return NextResponse.json(
        { error: 'Contenuto e accountUuid sono obbligatori' },
        { status: 400 }
      )
    }

    const token = process.env.ONLYSOCIAL_API_KEY
    const workspaceUuid = process.env.ONLYSOCIAL_WORKSPACE_UUID

    if (!token || !workspaceUuid) {
      return NextResponse.json(
        { error: 'Configurazione OnlySocial mancante' },
        { status: 500 }
      )
    }

    const api = new OnlySocialAPI({ token, workspaceUuid })
    const result = await api.createMediaPost(
      accountUuid,
      content,
      mediaUrls,
      scheduleDate,
      scheduleTime,
      postType
    )

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating OnlySocial post:', error)
    return NextResponse.json(
      { error: 'Errore nella creazione del post' },
      { status: 500 }
    )
  }
}
