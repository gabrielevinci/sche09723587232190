import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Lista i profili social associati all'utente corrente
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    // Trova l'utente e i suoi profili associati
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
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

    if (!user) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
    }

    // Estrai i profili social
    const socialProfiles = user.adminAssociations.map(assoc => ({
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
