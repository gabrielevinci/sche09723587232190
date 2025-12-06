import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const userId = 'cmhcsi8520006jg04xqlkl2qa' // gabriel

  console.log('🔧 Associo tutti gli account social a gabriel...\n')

  // Prendi tutti gli account social
  const accounts = await prisma.socialAccount.findMany()
  
  for (const account of accounts) {
    // Verifica se l'associazione esiste già
    const existing = await prisma.adminAssociation.findFirst({
      where: {
        userId,
        socialAccountId: account.id
      }
    })

    if (existing) {
      console.log(`⏭️  ${account.accountName} - già associato`)
    } else {
      await prisma.adminAssociation.create({
        data: {
          userId,
          socialAccountId: account.id,
          assignedBy: userId  // L'utente si auto-assegna
        }
      })
      console.log(`✅ ${account.accountName} - associato!`)
    }
  }

  console.log('\n🎉 Fatto! Ora gabriel può vedere tutti i profili.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
