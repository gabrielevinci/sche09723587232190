/**
 * Script per testare l'endpoint process-pending-videos
 * Usage: npx tsx scripts/test-process-pending.ts
 */

import { prisma } from '../src/lib/prisma'

async function main() {
  console.log('🧪 Testing process-pending-videos query...\n')
  
  const now = new Date()
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)
  
  console.log(`   Time now (UTC): ${now.toISOString()}`)
  console.log(`   1 hour from now: ${oneHourFromNow.toISOString()}\n`)

  // Simula la query dell'endpoint
  const videosToProcess = await prisma.scheduledPost.findMany({
    where: {
      OR: [
        {
          // Post PENDING da pre-caricare
          status: 'PENDING',
          preUploaded: false,
          scheduledFor: {
            lte: oneHourFromNow,
            // RIMOSSO gte: now
          }
        },
        {
          // Post MEDIA_UPLOADED da pubblicare
          status: 'MEDIA_UPLOADED',
          scheduledFor: {
            lte: new Date(now.getTime() + 5 * 60 * 1000),   // +5 min
            gte: new Date(now.getTime() - 30 * 60 * 1000)  // -30 min
          }
        }
      ]
    },
    orderBy: {
      scheduledFor: 'asc'
    }
  })

  console.log(`✅ Query returned ${videosToProcess.length} posts to process\n`)

  if (videosToProcess.length === 0) {
    console.log('❌ No posts found! Check the database.')
    return
  }

  // Raggruppa per stato
  const pendingPosts = videosToProcess.filter(p => p.status === 'PENDING')
  const uploadedPosts = videosToProcess.filter(p => p.status === 'MEDIA_UPLOADED')

  console.log(`📊 Summary:`)
  console.log(`   PENDING (to pre-upload): ${pendingPosts.length}`)
  console.log(`   MEDIA_UPLOADED (to publish): ${uploadedPosts.length}\n`)

  // Mostra PENDING
  if (pendingPosts.length > 0) {
    console.log('📤 PENDING posts that will be PRE-UPLOADED:')
    for (const post of pendingPosts) {
      const scheduledFor = new Date(post.scheduledFor)
      const diffMinutes = Math.round((scheduledFor.getTime() - now.getTime()) / 60000)
      
      console.log(`\n   📌 Post ID: ${post.id}`)
      console.log(`      Account: ${post.accountUuid}`)
      console.log(`      Caption: ${post.caption.substring(0, 50)}...`)
      console.log(`      Scheduled for: ${scheduledFor.toISOString()}`)
      console.log(`      Time diff: ${diffMinutes} minutes ${diffMinutes < 0 ? '(PAST!)' : '(future)'}`)
      console.log(`      Videos: ${post.videoUrls.length}`)
    }
  }

  // Mostra MEDIA_UPLOADED
  if (uploadedPosts.length > 0) {
    console.log('\n\n🚀 MEDIA_UPLOADED posts that will be PUBLISHED:')
    for (const post of uploadedPosts) {
      const scheduledFor = new Date(post.scheduledFor)
      const diffMinutes = Math.round((scheduledFor.getTime() - now.getTime()) / 60000)
      
      console.log(`\n   📌 Post ID: ${post.id}`)
      console.log(`      Post UUID: ${post.onlySocialPostUuid}`)
      console.log(`      Scheduled for: ${scheduledFor.toISOString()}`)
      console.log(`      Time diff: ${diffMinutes} minutes ${diffMinutes < 0 ? '(PAST!)' : '(future)'}`)
      console.log(`      Media IDs: ${post.onlySocialMediaIds.join(', ')}`)
    }
  }

  console.log('\n\n✅ The cron job WILL process these posts!')
}

main()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
