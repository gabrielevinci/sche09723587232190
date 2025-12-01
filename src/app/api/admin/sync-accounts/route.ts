/**
 * API Route: Sync Social Accounts from OnlySocial
 * POST /api/admin/sync-accounts
 * 
 * Sincronizza gli account social da OnlySocial nel database locale
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface OnlySocialAccount {
  id: number
  uuid: string
  name: string
  username: string
  provider: string
  created_at: string
  updated_at: string
}

interface OnlySocialResponse {
  data: OnlySocialAccount[]
}

export async function POST() {
  try {
    // Verifica che l'utente sia autenticato e sia admin
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      )
    }

    // Verifica che l'utente sia admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { isAdmin: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: 'Non autorizzato' },
        { status: 403 }
      )
    }

    // Configura le credenziali OnlySocial
    const apiKey = process.env.ONLYSOCIAL_API_KEY
    const workspaceUuid = process.env.ONLYSOCIAL_WORKSPACE_UUID

    if (!apiKey || !workspaceUuid) {
      return NextResponse.json(
        { error: 'Configurazione OnlySocial mancante' },
        { status: 500 }
      )
    }

    // Chiama l'API di OnlySocial per ottenere gli account
    const onlySocialUrl = `https://app.onlysocial.io/os/api/${workspaceUuid}/accounts`
    
    console.log('🔄 Fetching accounts from OnlySocial...')
    console.log('   URL:', onlySocialUrl)

    const response = await fetch(onlySocialUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ OnlySocial API Error:', response.status, errorText)
      return NextResponse.json(
        { error: `Errore OnlySocial API: ${response.status}` },
        { status: response.status }
      )
    }

    const data: OnlySocialResponse = await response.json()
    console.log(`✅ Ricevuti ${data.data?.length || 0} account da OnlySocial`)

    if (!data.data || data.data.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nessun account trovato su OnlySocial',
        synced: 0,
      })
    }

    // Sincronizza gli account nel database
    let syncedCount = 0
    for (const account of data.data) {
      try {
        await prisma.socialAccount.upsert({
          where: { accountId: account.uuid },
          update: {
            platform: account.provider.toLowerCase(),
            accountName: account.name || account.username,
            isActive: true,
            updatedAt: new Date(),
          },
          create: {
            platform: account.provider.toLowerCase(),
            accountName: account.name || account.username,
            accountId: account.uuid,
            isActive: true,
          },
        })
        syncedCount++
        console.log(`  ✓ Sincronizzato: ${account.name} (${account.provider})`)
      } catch (error) {
        console.error(`  ✗ Errore sincronizzazione account ${account.uuid}:`, error)
      }
    }

    console.log(`🎉 Sincronizzazione completata: ${syncedCount}/${data.data.length} account`)

    return NextResponse.json({
      success: true,
      message: `Sincronizzati ${syncedCount} account da OnlySocial`,
      synced: syncedCount,
      total: data.data.length,
    })

  } catch (error) {
    console.error('❌ Errore durante la sincronizzazione:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Errore interno' },
      { status: 500 }
    )
  }
}
