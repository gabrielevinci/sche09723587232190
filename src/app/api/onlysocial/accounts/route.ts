import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { OnlySocialAPI } from '@/lib/onlysocial-api'

export async function GET() {
  try {
    // Verifica autenticazione
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
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
    const accounts = await api.listAccounts()

    return NextResponse.json(accounts)
  } catch (error) {
    console.error('Error fetching OnlySocial accounts:', error)
    return NextResponse.json(
      { error: 'Errore nel recupero degli account' },
      { status: 500 }
    )
  }
}
