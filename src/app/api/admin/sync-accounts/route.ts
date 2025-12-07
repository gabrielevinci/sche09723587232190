/**
 * API Route: Sync Social Accounts from OnlySocial (via Lambda)
 * POST /api/admin/sync-accounts
 * 
 * Sincronizza gli account social da OnlySocial nel database locale
 * NOTA: Tutte le chiamate a OnlySocial passano da Lambda per isolamento
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// URL dell'API Gateway Lambda
const LAMBDA_API_URL = process.env.LAMBDA_API_URL || 'https://sxibldy7k8.execute-api.eu-central-1.amazonaws.com/prod/schedule'

interface OnlySocialAccount {
  id: number
  uuid: string
  name: string
  username: string
  provider: string
  created_at: string
  updated_at: string
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

    // Chiama Lambda per ottenere gli account da OnlySocial
    console.log('🔄 Fetching accounts via Lambda...')
    console.log('   URL:', LAMBDA_API_URL)

    const response = await fetch(LAMBDA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'check-accounts' }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Lambda API Error:', response.status, errorText)
      return NextResponse.json(
        { error: `Errore Lambda API: ${response.status}` },
        { status: response.status }
      )
    }

    const lambdaData = await response.json()
    
    if (!lambdaData.success) {
      return NextResponse.json(
        { error: lambdaData.error || 'Lambda returned error' },
        { status: 500 }
      )
    }
    
    const accounts: OnlySocialAccount[] = lambdaData.accounts || []
    console.log(`✅ Ricevuti ${accounts.length} account da Lambda`)

    if (accounts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nessun account trovato su OnlySocial',
        synced: 0,
      })
    }

    // Sincronizza gli account nel database
    // IMPORTANTE: accountId = ID numerico OnlySocial (richiesto per API create post)
    //             accountUuid = UUID OnlySocial (per riferimento)
    let syncedCount = 0
    for (const account of accounts) {
      try {
        // Usa l'UUID per cercare account esistenti, ma salva l'ID numerico
        const numericId = String(account.id) // ID numerico come stringa
        
        // Prima cerca se esiste già un account con questo UUID
        const existing = await prisma.socialAccount.findFirst({
          where: { accountUuid: account.uuid }
        })
        
        if (existing) {
          // Aggiorna account esistente
          await prisma.socialAccount.update({
            where: { id: existing.id },
            data: {
              platform: account.provider.toLowerCase(),
              accountName: account.name || account.username,
              accountId: numericId,  // ID numerico OnlySocial
              accountUuid: account.uuid,
              isActive: true,
              updatedAt: new Date(),
            },
          })
        } else {
          // Crea nuovo account
          await prisma.socialAccount.create({
            data: {
              platform: account.provider.toLowerCase(),
              accountName: account.name || account.username,
              accountId: numericId,  // ID numerico OnlySocial
              accountUuid: account.uuid,
              isActive: true,
            },
          })
        }
        syncedCount++
        console.log(`  ✓ Sincronizzato: ${account.name} (${account.provider}) - ID: ${numericId}`)
      } catch (error) {
        console.error(`  ✗ Errore sincronizzazione account ${account.uuid}:`, error)
      }
    }

    console.log(`🎉 Sincronizzazione completata: ${syncedCount}/${accounts.length} account`)

    return NextResponse.json({
      success: true,
      message: `Sincronizzati ${syncedCount} account da OnlySocial`,
      synced: syncedCount,
      total: accounts.length,
    })

  } catch (error) {
    console.error('❌ Errore durante la sincronizzazione:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Errore interno' },
      { status: 500 }
    )
  }
}
