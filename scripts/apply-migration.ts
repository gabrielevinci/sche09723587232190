import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function applyMigration() {
  console.log('🔄 Applicazione migrazione al database...')

  try {
    // Aggiungi colonna accountUuid a social_accounts
    console.log('📝 Aggiunta colonna accountUuid a social_accounts...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE social_accounts 
      ADD COLUMN IF NOT EXISTS "accountUuid" TEXT
    `)
    
    // Aggiungi colonna accountUuid a scheduled_posts
    console.log('� Aggiunta colonna accountUuid a scheduled_posts...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE scheduled_posts 
      ADD COLUMN IF NOT EXISTS "accountUuid" TEXT
    `)
    
    // Aggiungi colonna accountId a scheduled_posts
    console.log('� Aggiunta colonna accountId a scheduled_posts...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE scheduled_posts 
      ADD COLUMN IF NOT EXISTS "accountId" INTEGER
    `)
    
    console.log('✅ Migrazione applicata con successo!')
    
    // Verifica che le colonne siano state create
    console.log('🔍 Verifica colonne create...')
    
    const socialAccountsCheck = await prisma.$queryRawUnsafe<any[]>(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'social_accounts' 
        AND column_name = 'accountUuid'
    `)
    
    const scheduledPostsUuidCheck = await prisma.$queryRawUnsafe<any[]>(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'scheduled_posts' 
        AND column_name = 'accountUuid'
    `)
    
    const scheduledPostsIdCheck = await prisma.$queryRawUnsafe<any[]>(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'scheduled_posts' 
        AND column_name = 'accountId'
    `)
    
    console.log('✅ Colonne verificate:')
    console.log('  - social_accounts.accountUuid:', socialAccountsCheck.length > 0 ? '✓' : '✗')
    console.log('  - scheduled_posts.accountUuid:', scheduledPostsUuidCheck.length > 0 ? '✓' : '✗')
    console.log('  - scheduled_posts.accountId:', scheduledPostsIdCheck.length > 0 ? '✓' : '✗')
    
  } catch (error) {
    console.error('❌ Errore durante l\'applicazione della migrazione:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

applyMigration()
