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
    
    console.log('🔄 Fetching accounts from OnlySocial...')
    
    // Ottieni gli account da OnlySocial
    const response = await onlySocialAPI.listAccounts() as { 
      data?: Array<{ 
        id: number
        uuid: string
        name: string
        provider: string
        username?: string
        image?: string
      }> 
    }

    console.log('📥 Response from OnlySocial:', JSON.stringify(response, null, 2))

    if (!response.data || response.data.length === 0) {
      return NextResponse.json(
        { error: 'Nessun account trovato su OnlySocial' },
        { status: 404 }
      )
    }

    const accounts = response.data
    const syncedAccounts = []

    // Sincronizza ogni account nel database
    for (const account of accounts) {
      const synced = await prisma.socialAccount.upsert({
        where: { accountId: account.uuid },
        update: {
          accountName: account.username || account.name,
          platform: account.provider,
        },
        create: {
          accountId: account.uuid,
          accountName: account.username || account.name,
          platform: account.provider,
        },
      })
      syncedAccounts.push(synced)
    }

    return NextResponse.json({
      message: `${syncedAccounts.length} account sincronizzati`,
      accounts: syncedAccounts,
    })
  } catch (error) {
    console.error('❌ Errore sincronizzazione account:', error)
    console.error('Error details:', error instanceof Error ? error.message : String(error))
    return NextResponse.json(
      { 
        error: 'Errore sincronizzazione',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
