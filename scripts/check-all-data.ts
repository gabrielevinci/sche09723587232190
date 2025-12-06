import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Mostra tutti gli utenti e le loro associazioni
  const users = await prisma.user.findMany({
    include: {
      adminAssociations: {
        include: {
          socialAccount: {
            select: {
              id: true,
              accountName: true,
              accountId: true,
              accountUuid: true,
            }
          }
        }
      }
    }
  })
  
  console.log('📋 Utenti nel database:\n')
  for (const user of users) {
    console.log(`👤 ${user.name} (${user.email})`)
    console.log(`   ID: ${user.id}`)
    console.log(`   Admin: ${user.isAdmin}`)
    console.log(`   Profili associati: ${user.adminAssociations.length}`)
    
    if (user.adminAssociations.length > 0) {
      for (const assoc of user.adminAssociations) {
        console.log(`     📱 ${assoc.socialAccount.accountName}`)
        console.log(`        accountUuid: ${assoc.socialAccount.accountUuid}`)
      }
    }
    console.log('')
  }

  // Mostra anche gli account social
  console.log('\n📱 Account Social nel database:\n')
  const accounts = await prisma.socialAccount.findMany()
  for (const acc of accounts) {
    console.log(`  - ${acc.accountName} (${acc.platform})`)
    console.log(`    id: ${acc.id}`)
    console.log(`    accountId: ${acc.accountId}`)
    console.log(`    accountUuid: ${acc.accountUuid}`)
    console.log('')
  }

  // Mostra le associazioni
  console.log('\n🔗 Associazioni admin:\n')
  const associations = await prisma.adminAssociation.findMany({
    include: {
      user: { select: { name: true, email: true } },
      socialAccount: { select: { accountName: true } }
    }
  })
  
  if (associations.length === 0) {
    console.log('  ❌ Nessuna associazione trovata!')
  } else {
    for (const assoc of associations) {
      console.log(`  ${assoc.user.name} → ${assoc.socialAccount.accountName}`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
