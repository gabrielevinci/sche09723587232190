import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Simula la query che fa /api/user/profiles
  const user = await prisma.user.findFirst({
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
            }
          }
        }
      }
    }
  })
  
  console.log('User:', user?.name)
  console.log('Email:', user?.email)
  console.log('\nProfiles:')
  user?.adminAssociations.forEach(a => {
    console.log('\n  📱', a.socialAccount.accountName, `(${a.socialAccount.platform})`)
    console.log('     id:', a.socialAccount.id)
    console.log('     accountId:', a.socialAccount.accountId)
    console.log('     accountUuid:', a.socialAccount.accountUuid || '❌ NULL')
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
