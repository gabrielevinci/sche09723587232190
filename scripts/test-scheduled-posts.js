// Test script per verificare che la tabella scheduled_posts funzioni
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testScheduledPosts() {
  try {
    console.log('🔍 Testing scheduled_posts table...')
    
    // Test 1: Count records
    const count = await prisma.scheduledPost.count()
    console.log(`✅ Table exists! Current records: ${count}`)
    
    // Test 2: Query structure
    const sample = await prisma.scheduledPost.findFirst()
    if (sample) {
      console.log('📋 Sample record structure:', Object.keys(sample))
    } else {
      console.log('📋 No records yet, but table structure is valid')
    }
    
    console.log('✅ All tests passed!')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testScheduledPosts()
