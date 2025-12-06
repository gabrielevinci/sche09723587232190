import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📋 Post schedulati nel database:\n')

  const posts = await prisma.scheduledPost.findMany({
    orderBy: { scheduledFor: 'asc' }
  })

  if (posts.length === 0) {
    console.log('❌ Nessun post trovato!')
    return
  }

  const now = new Date()
  console.log(`⏰ Ora attuale UTC: ${now.toISOString()}`)
  console.log(`⏰ Ora attuale italiana: ${now.toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}\n`)

  for (const post of posts) {
    console.log(`📝 Post ID: ${post.id}`)
    console.log(`   Status: ${post.status}`)
    console.log(`   ScheduledFor (raw): ${post.scheduledFor.toISOString()}`)
    console.log(`   ScheduledFor (IT): ${post.scheduledFor.toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}`)
    console.log(`   AccountUuid: ${post.accountUuid}`)
    console.log(`   Caption: ${post.caption?.substring(0, 50) || '(vuota)'}...`)
    console.log('')
  }

  // Simula la query di Lambda
  console.log('\n🔍 Simulazione query Lambda:\n')
  
  const nowItalian = new Date()
  // Lambda usa questi range:
  const recoveryStart = new Date(nowItalian.getTime() - 60 * 60 * 1000) // now - 60min
  const recoveryEnd = nowItalian
  const upcomingStart = nowItalian
  const upcomingEnd = new Date(nowItalian.getTime() + 60 * 60 * 1000) // now + 60min
  
  console.log(`Recovery window: ${recoveryStart.toISOString()} to ${recoveryEnd.toISOString()}`)
  console.log(`Upcoming window: ${upcomingStart.toISOString()} to ${upcomingEnd.toISOString()}`)
  
  const pendingPosts = await prisma.scheduledPost.findMany({
    where: {
      status: 'PENDING',
      scheduledFor: {
        gte: recoveryStart,
        lte: upcomingEnd
      }
    }
  })
  
  console.log(`\n📊 Post trovati con status PENDING nella finestra: ${pendingPosts.length}`)
  pendingPosts.forEach(p => {
    console.log(`   - ${p.id}: ${p.scheduledFor.toISOString()} (${p.status})`)
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
