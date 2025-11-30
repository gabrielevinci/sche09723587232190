/**
 * Test di connessione al nuovo database
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testConnection() {
  console.log('🧪 Testing database connection...\n')
  
  try {
    // Test 1: Connessione base
    console.log('1️⃣ Testing basic connection...')
    await prisma.$connect()
    console.log('   ✅ Connected to database successfully!\n')
    
    // Test 2: Count users
    console.log('2️⃣ Counting users...')
    const userCount = await prisma.user.count()
    console.log(`   ✅ Found ${userCount} users\n`)
    
    // Test 3: Count scheduled posts
    console.log('3️⃣ Counting scheduled posts...')
    const postCount = await prisma.scheduledPost.count()
    console.log(`   ✅ Found ${postCount} scheduled posts\n`)
    
    // Test 4: Get posts by status
    console.log('4️⃣ Posts by status:')
    const statuses = ['PENDING', 'MEDIA_UPLOADED', 'PUBLISHED', 'FAILED', 'CANCELLED']
    
    for (const status of statuses) {
      const count = await prisma.scheduledPost.count({
        where: { status: status as any }
      })
      console.log(`   - ${status}: ${count}`)
    }
    
    console.log('\n✅ All tests passed! Database is working correctly.')
    
  } catch (error) {
    console.error('\n❌ Database connection failed!')
    console.error('Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
