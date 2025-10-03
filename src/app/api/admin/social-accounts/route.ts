import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Lista tutti gli account social disponibili
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const accounts = await prisma.socialAccount.findMany({
      include: {
        adminAssociations: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('Errore caricamento account:', error)
    return NextResponse.json(
      { error: 'Errore nel caricamento degli account' },
      { status: 500 }
    )
  }
}
