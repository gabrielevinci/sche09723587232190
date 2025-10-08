/**
 * Script per creare un nuovo utente
 * Uso: node scripts/create-user.js "Nome" "email@example.com" "password"
 */

// Carica le variabili d'ambiente da .env.local
require('dotenv').config({ path: '.env.local' })

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function createUser(name, email, password) {
  try {
    // Hash della password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Crea l'utente
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        isActive: true,
        isAdmin: true, // Primo utente è admin di default
      },
    })

    console.log('✅ Utente creato con successo:')
    console.log(`   Nome: ${user.name}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Admin: ${user.isAdmin}`)
    console.log(`   Attivo: ${user.isActive}`)
    console.log('\n🔑 Ora puoi accedere con:')
    console.log(`   Email: ${email}`)
    console.log(`   Password: ${password}`)
  } catch (error) {
    if (error.code === 'P2002') {
      console.error('❌ Errore: Un utente con questa email esiste già')
    } else {
      console.error('❌ Errore:', error.message)
    }
  } finally {
    await prisma.$disconnect()
  }
}

const name = process.argv[2]
const email = process.argv[3]
const password = process.argv[4]

if (!name || !email || !password) {
  console.error('❌ Uso: node scripts/create-user.js "Nome Cognome" "email@example.com" "password"')
  console.error('\nEsempio:')
  console.error('   node scripts/create-user.js "Mario Rossi" "mario@example.com" "password123"')
  process.exit(1)
}

createUser(name, email, password)
