import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Associa un account social a un utente
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    // Verifica che l'utente sia admin
    const admin = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const { userId, socialAccountId } = await request.json()

    if (!userId || !socialAccountId) {
      return NextResponse.json(
        { error: 'userId e socialAccountId sono richiesti' },
        { status: 400 }
      )
    }

    // Crea l'associazione
    const association = await prisma.adminAssociation.create({
      data: {
        userId,
        socialAccountId,
        assignedBy: admin.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        socialAccount: true,
      },
    })

    // Attiva l'utente se non è già attivo
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    })

    return NextResponse.json({
      message: 'Account associato con successo',
      association,
    })
  } catch (error) {
    console.error('Errore associazione account:', error)
    
    // Gestisci errore di duplicato
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { error: 'Associazione già esistente' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Errore nell\'associazione' },
      { status: 500 }
    )
  }
}

// DELETE - Rimuovi un'associazione
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const admin = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const { userId, socialAccountId } = await request.json()

    if (!userId || !socialAccountId) {
      return NextResponse.json(
        { error: 'userId e socialAccountId sono richiesti' },
        { status: 400 }
      )
    }

    // Elimina l'associazione
    await prisma.adminAssociation.delete({
      where: {
        userId_socialAccountId: {
          userId,
          socialAccountId,
        },
      },
    })

    // Verifica se l'utente ha ancora associazioni attive
    const remainingAssociations = await prisma.adminAssociation.count({
      where: { userId },
    })

    // Se non ha più associazioni, disattiva l'utente
    if (remainingAssociations === 0) {
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      })
    }

    return NextResponse.json({
      message: 'Associazione rimossa con successo',
    })
  } catch (error) {
    console.error('Errore rimozione associazione:', error)
    return NextResponse.json(
      { error: 'Errore nella rimozione' },
      { status: 500 }
    )
  }
}
