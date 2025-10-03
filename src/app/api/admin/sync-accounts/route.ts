import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { OnlySocialAPI } from '@/lib/onlysocial-api'

// Sincronizza gli account da OnlySocial al database locale
export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    // Verifica che l'utente sia admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const apiKey = process.env.ONLYSOCIAL_API_KEY
    const workspaceUuid = process.env.ONLYSOCIAL_WORKSPACE_UUID

    if (!apiKey || !workspaceUuid) {
      return NextResponse.json(
        { error: 'Configurazione OnlySocial mancante' },
        { status: 500 }
      )
    }

    const onlySocialAPI = new OnlySocialAPI({
      token: apiKey,
      workspaceUuid: workspaceUuid,
    })
    
    // Ottieni gli account da OnlySocial
    const response = await onlySocialAPI.listAccounts() as { 
      data?: Array<{ 
        id: string
        name: string
        platform: string
        username?: string
      }> 
    }

    if (!response.data) {
      return NextResponse.json(
        { error: 'Nessun account trovato' },
        { status: 404 }
      )
    }

    const accounts = response.data
    const syncedAccounts = []

    // Sincronizza ogni account nel database
    for (const account of accounts) {
      const synced = await prisma.socialAccount.upsert({
        where: { accountId: account.id },
        update: {
          accountName: account.username || account.name,
          platform: account.platform,
        },
        create: {
          accountId: account.id,
          accountName: account.username || account.name,
          platform: account.platform,
        },
      })
      syncedAccounts.push(synced)
    }

    return NextResponse.json({
      message: `${syncedAccounts.length} account sincronizzati`,
      accounts: syncedAccounts,
    })
  } catch (error) {
    console.error('Errore sincronizzazione account:', error)
    return NextResponse.json(
      { error: 'Errore sincronizzazione' },
      { status: 500 }
    )
  }
}
