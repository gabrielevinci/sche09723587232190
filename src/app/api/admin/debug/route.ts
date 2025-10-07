import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Endpoint di debug per verificare lo stato dell'utente
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json({ 
        error: 'Non autenticato',
        session: null
      }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return NextResponse.json({
      session: {
        email: session.user.email,
        name: session.user.name,
        id: session.user.id
      },
      user: user,
      isAuthenticated: !!session,
      isAdmin: !!user?.isAdmin,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({
      error: 'Errore debug',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
