/**
 * Script per verificare i post MEDIA_UPLOADED pronti per pubblicazione
 * Usage: npx tsx scripts/debug-publish.ts
 */

import { prisma } from '../src/lib/prisma'

async function main() {
  console.log('🔍 Debugging publish issue...\n')
  
  const now = new Date()
  console.log(`   Time now (UTC): ${now.toISOString()}\n`)

  // Trova tutti i post MEDIA_UPLOADED
  const uploadedPosts = await prisma.scheduledPost.findMany({
    where: {
      status: 'MEDIA_UPLOADED',
    },
    orderBy: {
      scheduledFor: 'asc',
    },
  })

  console.log(`📊 Found ${uploadedPosts.length} MEDIA_UPLOADED posts\n`)

  if (uploadedPosts.length === 0) {
    console.log('✅ No MEDIA_UPLOADED posts (all published or none uploaded yet)')
    return
  }

  // Finestre temporali per pubblicazione (aggiornate a -2 ore)
  const past120min = new Date(now.getTime() - 120 * 60000)
  const future5min = new Date(now.getTime() + 5 * 60000)

  console.log(`📅 Publication window:`)
  console.log(`   From: ${past120min.toISOString()} (-2 hours)`)
  console.log(`   To:   ${future5min.toISOString()} (+5 min)\n`)

  for (const post of uploadedPosts) {
    const scheduledFor = new Date(post.scheduledFor)
    const diffMinutes = Math.round((scheduledFor.getTime() - now.getTime()) / 60000)
    const inWindow = scheduledFor >= past120min && scheduledFor <= future5min

    console.log(`📌 Post ID: ${post.id}`)
    console.log(`   Account UUID: ${post.accountUuid}`)
    console.log(`   Caption: ${post.caption.substring(0, 50)}...`)
    console.log(`   Scheduled for: ${scheduledFor.toISOString()}`)
    console.log(`   Time diff: ${diffMinutes} minutes ${diffMinutes < 0 ? '(PAST!)' : '(future)'}`)
    console.log(`   In publication window: ${inWindow ? '✅ YES' : '❌ NO'}`)
    console.log(`   Has onlySocialPostUuid: ${post.onlySocialPostUuid ? '✅ YES' : '❌ NO'}`)
    
    if (post.onlySocialPostUuid) {
      console.log(`   Post UUID: ${post.onlySocialPostUuid}`)
    }
    
    console.log(`   Has media IDs: ${post.onlySocialMediaIds.length > 0 ? '✅ YES' : '❌ NO'}`)
    if (post.onlySocialMediaIds.length > 0) {
      console.log(`   Media IDs: ${post.onlySocialMediaIds.join(', ')}`)
    }
    
    console.log(`   Pre-uploaded at: ${post.preUploadAt?.toISOString() || 'N/A'}`)
    
    // Diagnosi
    console.log(`\n   🔍 Diagnosis:`)
    if (!inWindow) {
      console.log(`      ⚠️ NOT in publication window (needs to be within -2h to +5min)`)
      if (diffMinutes < -120) {
        console.log(`      ⚠️ Post is too old (${Math.abs(diffMinutes)} minutes ago)`)
      } else if (diffMinutes > 5) {
        console.log(`      ⚠️ Post is too far in future (${diffMinutes} minutes)`)
      }
    } else {
      console.log(`      ✅ In publication window - SHOULD be published!`)
    }
    
    if (!post.onlySocialPostUuid && post.onlySocialMediaIds.length === 0) {
      console.log(`      ❌ NO post UUID and NO media IDs - cannot publish!`)
      console.log(`      💡 Suggestion: Post was not properly pre-uploaded`)
    } else if (!post.onlySocialPostUuid && post.onlySocialMediaIds.length > 0) {
      console.log(`      ⚠️ Has media IDs but NO post UUID`)
      console.log(`      💡 This is OK for new system - post will be created at publish time`)
    } else if (post.onlySocialPostUuid) {
      console.log(`      ✅ Has post UUID - can be published with publishPostNow()`)
    }
    
    console.log('')
  }

  // Summary
  const postsInWindow = uploadedPosts.filter(post => {
    const scheduledFor = new Date(post.scheduledFor)
    return scheduledFor >= past120min && scheduledFor <= future5min
  })

  const postsWithUuid = uploadedPosts.filter(post => post.onlySocialPostUuid)
  const postsWithMediaIds = uploadedPosts.filter(post => post.onlySocialMediaIds.length > 0)

  console.log(`\n📊 Summary:`)
  console.log(`   Total MEDIA_UPLOADED: ${uploadedPosts.length}`)
  console.log(`   In publication window: ${postsInWindow.length}`)
  console.log(`   With post UUID: ${postsWithUuid.length}`)
  console.log(`   With media IDs only: ${postsWithMediaIds.length}`)
  
  if (postsInWindow.length === 0) {
    console.log(`\n⚠️ No posts in publication window!`)
    console.log(`   The cron job won't publish anything.`)
    console.log(`   Wait until posts are within -2h to +5min window.`)
  } else {
    console.log(`\n✅ ${postsInWindow.length} post(s) SHOULD be published by cron job!`)
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
