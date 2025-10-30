/**
 * Script per verificare i post in PENDING nel database
 * Usage: npx tsx scripts/check-pending-posts.ts
 */

import { prisma } from '../src/lib/prisma'

async function main() {
  console.log('🔍 Checking for PENDING posts...\n')

  // 1. Trova tutti i post PENDING
  const pendingPosts = await prisma.scheduledPost.findMany({
    where: {
      status: 'PENDING',
      preUploaded: false,
    },
    orderBy: {
      scheduledFor: 'asc',
    },
  })

  console.log(`📋 Found ${pendingPosts.length} PENDING posts\n`)

  if (pendingPosts.length === 0) {
    console.log('✅ No pending posts found!')
    return
  }

  // 2. Mostra dettagli di ogni post
  const now = new Date()
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

  for (const post of pendingPosts) {
    const scheduledFor = new Date(post.scheduledFor)
    const diffMinutes = Math.round((scheduledFor.getTime() - now.getTime()) / 60000)
    const shouldBeUploaded = scheduledFor <= oneHourFromNow

    console.log(`📌 Post ID: ${post.id}`)
    console.log(`   Account: ${post.accountUuid}`)
    console.log(`   Caption: ${post.caption.substring(0, 50)}...`)
    console.log(`   Videos: ${post.videoUrls.length}`)
    console.log(`   Scheduled for: ${scheduledFor.toISOString()}`)
    console.log(`   Time diff: ${diffMinutes} minutes ${diffMinutes < 0 ? '(PAST!)' : '(future)'}`)
    console.log(`   Should be uploaded: ${shouldBeUploaded ? '✅ YES' : '❌ NO (too far in future)'}`)
    console.log(`   Status: ${post.status}`)
    console.log(`   Pre-uploaded: ${post.preUploaded}`)
    console.log('')
  }

  // 3. Verifica condizioni per pre-upload
  console.log('\n📊 Summary:')
  console.log(`   Now (UTC): ${now.toISOString()}`)
  console.log(`   1 hour from now: ${oneHourFromNow.toISOString()}`)
  
  const shouldBeProcessed = pendingPosts.filter(post => {
    const scheduledFor = new Date(post.scheduledFor)
    return scheduledFor <= oneHourFromNow
  })

  console.log(`\n   Posts that SHOULD be processed by pre-upload: ${shouldBeProcessed.length}`)
  
  if (shouldBeProcessed.length > 0) {
    console.log('\n   These posts should be picked up by /api/cron/pre-upload:')
    shouldBeProcessed.forEach(post => {
      console.log(`   - ${post.id}: ${new Date(post.scheduledFor).toISOString()}`)
    })
  }

  // 4. Trova post MEDIA_UPLOADED
  const uploadedPosts = await prisma.scheduledPost.findMany({
    where: {
      status: 'MEDIA_UPLOADED',
    },
    orderBy: {
      scheduledFor: 'asc',
    },
  })

  console.log(`\n📤 Found ${uploadedPosts.length} MEDIA_UPLOADED posts`)
  
  if (uploadedPosts.length > 0) {
    const past30min = new Date(now.getTime() - 30 * 60000)
    const future5min = new Date(now.getTime() + 5 * 60000)
    
    for (const post of uploadedPosts) {
      const scheduledFor = new Date(post.scheduledFor)
      const diffMinutes = Math.round((scheduledFor.getTime() - now.getTime()) / 60000)
      const shouldBePublished = scheduledFor >= past30min && scheduledFor <= future5min

      console.log(`\n📌 Post ID: ${post.id}`)
      console.log(`   Scheduled for: ${scheduledFor.toISOString()}`)
      console.log(`   Time diff: ${diffMinutes} minutes ${diffMinutes < 0 ? '(PAST!)' : '(future)'}`)
      console.log(`   Should be published: ${shouldBePublished ? '✅ YES' : '❌ NO'}`)
      console.log(`   Media IDs: ${post.onlySocialMediaIds.join(', ')}`)
    }
  }
}

main()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
