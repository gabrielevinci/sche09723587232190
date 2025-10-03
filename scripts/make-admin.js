/**
 * Script per rendere un utente amministratore
 * Uso: node scripts/make-admin.js email@example.com
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function makeAdmin(email) {
  try {
    const user = await prisma.user.update({
      where: { email },
      data: { isAdmin: true, isActive: true },
    })

    console.log('✅ Utente promosso ad amministratore:')
    console.log(`   Nome: ${user.name}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Admin: ${user.isAdmin}`)
    console.log(`   Attivo: ${user.isActive}`)
  } catch (error) {
    console.error('❌ Errore:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

const email = process.argv[2]

if (!email) {
  console.error('❌ Uso: node scripts/make-admin.js email@example.com')
  process.exit(1)
}

makeAdmin(email)
