// Script per migrare il database dal vecchio schema al nuovo
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrate() {
  console.log('🔄 Starting database migration...')

  try {
    // 1. Aggiungi nuove colonne (Prisma farà questo automaticamente)
    console.log('✅ Step 1: Schema già aggiornato da Prisma')

    // 2. Migra dati da singolo video a array
    console.log('📦 Step 2: Migrating single video to array format...')
    
    // Questo sarà gestito dal db push con --accept-data-loss
    // Per ora, segniamo tutti i post esistenti come già migrati
    
    await prisma.$executeRaw`
      UPDATE scheduled_posts 
      SET "videoUrls" = ARRAY["videoUrl"],
          "videoFilenames" = ARRAY["videoFilename"],
          "videoSizes" = ARRAY["videoSize"]
      WHERE "videoUrl" IS NOT NULL 
        AND array_length("videoUrls", 1) IS NULL
    `

    console.log('✅ Step 2: Video data migrated')

    // 3. Migra onlySocialMediaId
    console.log('📦 Step 3: Migrating media IDs...')
    
    await prisma.$executeRaw`
      UPDATE scheduled_posts 
      SET "onlySocialMediaIds" = ARRAY["onlySocialMediaId"]
      WHERE "onlySocialMediaId" IS NOT NULL 
        AND array_length("onlySocialMediaIds", 1) IS NULL
    `

    console.log('✅ Step 3: Media IDs migrated')

    // 4. Migra post IDs
    console.log('📦 Step 4: Migrating post UUIDs...')
    
    await prisma.$executeRaw`
      UPDATE scheduled_posts 
      SET "onlySocialPostUuid" = "onlySocialPostId"
      WHERE "onlySocialPostId" IS NOT NULL 
        AND "onlySocialPostUuid" IS NULL
    `

    console.log('✅ Step 4: Post UUIDs migrated')

    // 5. Imposta preUploaded flag
    console.log('📦 Step 5: Setting preUploaded flags...')
    
    await prisma.$executeRaw`
      UPDATE scheduled_posts 
      SET "preUploaded" = true,
          "preUploadAt" = "uploadedToOSAt"
      WHERE "uploadedToOSAt" IS NOT NULL
    `

    console.log('✅ Step 5: PreUploaded flags set')

    console.log('✅ Migration completed successfully!')

  } catch (error) {
    console.error('❌ Migration error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

migrate()
  .then(() => {
    console.log('🎉 All done! You can now run: npx prisma db push --accept-data-loss')
    process.exit(0)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
