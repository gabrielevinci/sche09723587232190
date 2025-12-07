import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkAndUpdateAccountsStatus } from '@/lib/onlysocial-sync'

// GET - Lista i profili social associati all'utente corrente
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    // Trova l'utente
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
    }

    // STEP 1: Verifica e aggiorna lo stato degli account OnlySocial
    console.log('🔍 [Profiles API] Checking OnlySocial accounts status...')
    try {
      // TODO: Rimuovere forceCheck=true dopo aver verificato l'isolamento Lambda
      const syncResult = await checkAndUpdateAccountsStatus(user.id, true) // TEMP: force check per test
      console.log('✅ [Profiles API] Sync completed:', syncResult)
      
      if (syncResult.errors.length > 0) {
        console.warn('⚠️  [Profiles API] Sync had errors:', syncResult.errors)
      }
    } catch (error) {
      // Non bloccare se il sync fallisce - continua comunque
      console.error('❌ [Profiles API] Sync failed, continuing anyway:', error)
    }

    // STEP 2: Recupera i profili aggiornati dal database
    const userWithProfiles = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        adminAssociations: {
          include: {
            socialAccount: {
              select: {
                id: true,
                platform: true,
                accountName: true,
                accountId: true,
                accountUuid: true,
                isActive: true,
                createdAt: true
              }
            }
          }
        }
      }
    })

    if (!userWithProfiles) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
    }

    // Estrai i profili social con stato aggiornato
    const socialProfiles = userWithProfiles.adminAssociations.map(assoc => ({
      id: assoc.socialAccount.id,
      platform: assoc.socialAccount.platform,
      accountName: assoc.socialAccount.accountName,
      accountId: assoc.socialAccount.accountId,
      accountUuid: assoc.socialAccount.accountUuid,
      isActive: assoc.socialAccount.isActive,
      assignedAt: assoc.assignedAt,
      createdAt: assoc.socialAccount.createdAt
    }))

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isActive: user.isActive
      },
      socialProfiles,
      totalProfiles: socialProfiles.length
    })
  } catch (error) {
    console.error('Errore recupero profili utente:', error)
    return NextResponse.json(
      { error: 'Errore nel recupero dei profili' },
      { status: 500 }
    )
  }
}
