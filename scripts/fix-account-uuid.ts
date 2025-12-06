/**
 * Script per verificare e fixare gli accountUuid nel database
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Verifico gli account social...\n')

  // 1. Mostra tutti gli account social
  const accounts = await prisma.socialAccount.findMany({
    select: {
      id: true,
      accountName: true,
      accountId: true,
      accountUuid: true,
      platform: true,
    }
  })

  console.log('📋 Account nel database:')
  for (const acc of accounts) {
    console.log(`  - ${acc.accountName} (${acc.platform})`)
    console.log(`    accountId: ${acc.accountId}`)
    console.log(`    accountUuid: ${acc.accountUuid || '❌ NULL'}`)
    console.log('')
  }

  // 2. Fix: copia accountId in accountUuid se null
  const accountsWithoutUuid = accounts.filter(a => !a.accountUuid)
  
  if (accountsWithoutUuid.length > 0) {
    console.log(`\n🔧 Fixing ${accountsWithoutUuid.length} account senza UUID...\n`)
    
    for (const acc of accountsWithoutUuid) {
      await prisma.socialAccount.update({
        where: { id: acc.id },
        data: { accountUuid: acc.accountId }
      })
      console.log(`  ✅ Fixed: ${acc.accountName} -> accountUuid = ${acc.accountId}`)
    }
  } else {
    console.log('✅ Tutti gli account hanno già accountUuid popolato')
  }

  // 3. Verifica anche lo schema della tabella scheduled_posts
  console.log('\n📊 Verifica scheduled_posts...')
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'scheduled_posts' 
      AND column_name IN ('account_uuid', 'account_id')
    `
    console.log('Colonne scheduled_posts:')
    console.log(result)
  } catch (e) {
    console.log('Impossibile verificare lo schema:', e)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
