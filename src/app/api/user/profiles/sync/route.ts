import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkAndUpdateAccountsStatus } from '@/lib/onlysocial-sync'

/**
 * POST /api/user/profiles/sync
 * 
 * Forza il refresh dello stato degli account OnlySocial
 * bypassa la cache e controlla immediatamente
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    // Trova l'utente
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
    }

    console.log('🔄 [Profiles Sync API] Force sync requested for user:', user.id)

    // Forza il controllo (bypassa cache)
    const syncResult = await checkAndUpdateAccountsStatus(user.id, true)

    console.log('✅ [Profiles Sync API] Sync completed:', syncResult)

    return NextResponse.json({
      success: true,
      message: 'Stato account aggiornato',
      result: {
        total: syncResult.total,
        updated: syncResult.updated,
        errors: syncResult.errors,
      }
    })
  } catch (error) {
    console.error('❌ [Profiles Sync API] Error:', error)
    return NextResponse.json(
      { 
        error: 'Errore durante il sync degli account',
        details: (error as Error).message 
      },
      { status: 500 }
    )
  }
}
