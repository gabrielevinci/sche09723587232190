/**
 * Script per aggiornare accountId con l'ID numerico OnlySocial
 * 
 * Mapping conosciuto:
 * - chartees_: ID = 64699, UUID = 8fd2262d-e109-474a-baa0-d2f67a12ae56
 * - IncrementiOnline - Servizi: ID = 58474, UUID = a9c0ac26-3b9a-4292-8b60-62534aa60f23
 * - riassuntischool: ID = 58307, UUID = 5877d32c-9284-4a65-bfff-65b666097009
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Mapping UUID -> ID numerico (da OnlySocial check-accounts)
const UUID_TO_NUMERIC_ID: Record<string, number> = {
  '8fd2262d-e109-474a-baa0-d2f67a12ae56': 64699,   // chartees_
  'a9c0ac26-3b9a-4292-8b60-62534aa60f23': 58474,   // IncrementiOnline - Servizi
  '5877d32c-9284-4a65-bfff-65b666097009': 58307,   // riassuntischool
}

async function main() {
  console.log('🔧 Fixing accountId with numeric OnlySocial IDs...\n')
  
  const accounts = await prisma.socialAccount.findMany()
  
  console.log(`Found ${accounts.length} accounts:\n`)
  
  for (const account of accounts) {
    console.log(`📱 ${account.accountName}`)
    console.log(`   Current accountId: ${account.accountId}`)
    console.log(`   Current accountUuid: ${account.accountUuid}`)
    
    // Cerca l'ID numerico usando l'UUID
    const uuid = account.accountUuid || account.accountId
    const numericId = UUID_TO_NUMERIC_ID[uuid || '']
    
    if (numericId) {
      // Aggiorna con l'ID numerico
      await prisma.socialAccount.update({
        where: { id: account.id },
        data: { accountId: String(numericId) }
      })
      console.log(`   ✅ Updated accountId to: ${numericId}`)
    } else {
      console.log(`   ⚠️ No numeric ID mapping found for UUID: ${uuid}`)
    }
    console.log('')
  }
  
  console.log('✅ Done!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
