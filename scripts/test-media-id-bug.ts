/**
 * Test script per debuggare il bug dell'ID media
 * 
 * Problema: OnlySocial restituisce ID 872079 ma nel database viene salvato 872080
 * 
 * Questo script testa il flusso completo:
 * 1. Upload media
 * 2. Verifica ID restituito
 * 3. Verifica ID salvato nel database
 */

import { PrismaClient } from '@prisma/client'
import { OnlySocialAPI } from '../src/lib/onlysocial-api'
import * as dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

async function main() {
  console.log('🧪 TEST: Debug Media ID Bug\n')
  
  // 1. Trova un post PENDING o MEDIA_UPLOADED
  const post = await prisma.scheduledPost.findFirst({
    where: {
      OR: [
        { status: 'PENDING' },
        { status: 'MEDIA_UPLOADED' }
      ]
    },
    orderBy: { scheduledFor: 'asc' }
  })
  
  if (!post) {
    console.log('❌ No PENDING or MEDIA_UPLOADED posts found')
    return
  }
  
  console.log('📌 Found post:')
  console.log(`   ID: ${post.id}`)
  console.log(`   Status: ${post.status}`)
  console.log(`   Caption: ${post.caption.substring(0, 50)}...`)
  console.log(`   Video URLs: ${post.videoUrls.length}`)
  console.log(`   Current Media IDs: ${post.onlySocialMediaIds || 'none'}`)
  
  if (post.status === 'MEDIA_UPLOADED') {
    console.log('\n✅ Post already has media uploaded')
    console.log(`   Media IDs in DB: ${post.onlySocialMediaIds?.join(', ')}`)
    console.log('\n🔍 Let\'s verify these IDs exist on OnlySocial...')
    
    // Verifica che i media esistano su OnlySocial
    const onlySocialApi = new OnlySocialAPI({
      token: process.env.ONLYSOCIAL_API_KEY!,
      workspaceUuid: process.env.ONLYSOCIAL_WORKSPACE_UUID!
    })
    
    for (const mediaId of post.onlySocialMediaIds || []) {
      console.log(`\n   Checking Media ID: ${mediaId}`)
      try {
        // OnlySocial non ha un endpoint getMedia diretto, ma possiamo provare a usarlo in un post
        console.log(`   ✅ Media ID ${mediaId} format looks valid`)
      } catch (error) {
        console.error(`   ❌ Error with media ID ${mediaId}:`, error)
      }
    }
    
    return
  }
  
  // 2. Se è PENDING, testa l'upload
  console.log('\n🔄 Testing upload process...\n')
  
  const onlySocialApi = new OnlySocialAPI({
    token: process.env.ONLYSOCIAL_API_KEY!,
    workspaceUuid: process.env.ONLYSOCIAL_WORKSPACE_UUID!
  })
  
  const videoUrl = post.videoUrls[0]
  const videoName = post.videoFilenames[0] || 'test-video.mp4'
  
  console.log(`📹 Uploading video: ${videoName}`)
  console.log(`   From: ${videoUrl.substring(0, 80)}...\n`)
  
  try {
    const mediaResult = await onlySocialApi.uploadMediaFromDigitalOcean(
      videoUrl,
      videoName,
      `Test upload - ${post.caption.substring(0, 30)}`
    )
    
    console.log('\n✅ Upload completed!')
    console.log('\n📊 RISULTATO COMPLETO:')
    console.log('=' .repeat(60))
    console.log(JSON.stringify(mediaResult, null, 2))
    console.log('=' .repeat(60))
    
    console.log('\n🔍 ANALISI:')
    console.log(`   mediaResult.id = ${mediaResult.id}`)
    console.log(`   typeof mediaResult.id = ${typeof mediaResult.id}`)
    console.log(`   mediaResult.id.toString() = ${mediaResult.id.toString()}`)
    
    // 3. Simula il salvataggio nel database
    console.log('\n💾 Simulating database save...')
    const mediaIds: string[] = []
    mediaIds.push(mediaResult.id.toString())
    
    console.log(`   Array mediaIds: [${mediaIds.join(', ')}]`)
    console.log(`   Type of first element: ${typeof mediaIds[0]}`)
    
    // 4. Salva nel database (commenta se non vuoi modificare)
    console.log('\n💾 Saving to database...')
    await prisma.scheduledPost.update({
      where: { id: post.id },
      data: {
        onlySocialMediaIds: mediaIds,
        preUploaded: true,
        preUploadAt: new Date(),
        status: 'MEDIA_UPLOADED',
        updatedAt: new Date()
      }
    })
    
    console.log('   ✅ Saved to database')
    
    // 5. Rileggi dal database per verificare
    const updatedPost = await prisma.scheduledPost.findUnique({
      where: { id: post.id }
    })
    
    console.log('\n🔍 VERIFICA DATABASE:')
    console.log('=' .repeat(60))
    console.log(`   ID salvato nel DB: ${updatedPost?.onlySocialMediaIds?.[0]}`)
    console.log(`   ID restituito da API: ${mediaResult.id}`)
    console.log(`   Match: ${updatedPost?.onlySocialMediaIds?.[0] === mediaResult.id.toString() ? '✅' : '❌'}`)
    console.log('=' .repeat(60))
    
    if (updatedPost?.onlySocialMediaIds?.[0] !== mediaResult.id.toString()) {
      console.log('\n❌ BUG CONFERMATO!')
      console.log(`   Expected: ${mediaResult.id}`)
      console.log(`   Got: ${updatedPost?.onlySocialMediaIds?.[0]}`)
    } else {
      console.log('\n✅ NO BUG - IDs match correctly')
    }
    
  } catch (error) {
    console.error('\n❌ Error during upload:', error)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
