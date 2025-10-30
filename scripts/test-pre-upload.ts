/**
 * Script per testare il cron job di pre-upload
 * Usage: npx tsx scripts/test-pre-upload.ts
 */

import { getPostsDueForPreUpload } from '../src/lib/db/neon'

async function main() {
  console.log('🧪 Testing pre-upload query...\n')
  console.log(`   Time now (UTC): ${new Date().toISOString()}\n`)

  // Testa con 1 ora
  const posts = await getPostsDueForPreUpload(1)

  console.log(`✅ Query returned ${posts.length} posts\n`)

  if (posts.length === 0) {
    console.log('❌ No posts found! The query might have a problem.')
    return
  }

  for (const post of posts) {
    const now = new Date()
    const scheduledFor = new Date(post.scheduledFor)
    const diffMinutes = Math.round((scheduledFor.getTime() - now.getTime()) / 60000)

    console.log(`📌 Post ID: ${post.id}`)
    console.log(`   Account: ${post.accountUuid}`)
    console.log(`   Caption: ${post.caption.substring(0, 50)}...`)
    console.log(`   Scheduled for: ${scheduledFor.toISOString()}`)
    console.log(`   Time diff: ${diffMinutes} minutes ${diffMinutes < 0 ? '(PAST!)' : '(future)'}`)
    console.log(`   Videos: ${post.videoUrls.length}`)
    console.log(`   Video URLs:`)
    post.videoUrls.forEach((url, i) => {
      console.log(`      ${i + 1}. ${url.substring(0, 80)}...`)
    })
    console.log('')
  }

  console.log('✅ The cron job WILL find these posts!')
}

main()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
