/**
 * Test Script per OnlySocial API Integration
 * 
 * Questo script permette di testare rapidamente l'integrazione con OnlySocial
 * senza dover usare l'interfaccia utente.
 * 
 * USO:
 * 1. Assicurati di avere un video già caricato su DigitalOcean
 * 2. Ottieni l'UUID del tuo account OnlySocial
 * 3. Aggiorna le variabili TEST_VIDEO_URL e TEST_ACCOUNT_UUID
 * 4. Esegui: node scripts/test-onlysocial-integration.js
 */

// ⚠️ CONFIGURAZIONE TEST
const TEST_VIDEO_URL = 'https://scheduler-0chiacchiere.lon1.digitaloceanspaces.com/user1/profile1/1696666666666/test-video.mp4'
const TEST_ACCOUNT_UUID = 'your-account-uuid-here'
const TEST_CAPTION = 'Test video caricato automaticamente! 🚀 #test'
const TEST_POST_TYPE = 'reel'

// Base URL del tuo server
const BASE_URL = 'http://localhost:3000'

// Colori per output console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

// Helper per logging colorato
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  step: (num, msg) => console.log(`${colors.cyan}[${num}]${colors.reset} ${msg}`)
}

// Funzione principale di test
async function testOnlySocialIntegration() {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 TEST ONLYSOCIAL API INTEGRATION')
  console.log('='.repeat(60) + '\n')

  try {
    // ========================================
    // TEST 1: Verifica Autenticazione
    // ========================================
    log.step(1, 'Testing OnlySocial authentication...')
    
    const authResponse = await fetch(`${BASE_URL}/api/onlysocial/accounts`)
    const authData = await authResponse.json()
    
    if (authResponse.ok && authData) {
      log.success('Authentication OK!')
      log.info(`Found ${authData.data?.length || 0} accounts`)
    } else {
      log.error('Authentication failed!')
      log.error(`Error: ${authData.error || 'Unknown error'}`)
      return
    }

    console.log('')

    // ========================================
    // TEST 2: Upload Media da DigitalOcean
    // ========================================
    log.step(2, 'Testing media upload from DigitalOcean...')
    log.info(`Video URL: ${TEST_VIDEO_URL.substring(0, 60)}...`)
    
    const uploadResponse = await fetch(`${BASE_URL}/api/onlysocial/upload-media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        digitalOceanUrl: TEST_VIDEO_URL,
        videoName: 'test-video.mp4',
        altText: 'Test video uploaded via API'
      })
    })

    const uploadData = await uploadResponse.json()

    if (uploadResponse.ok && uploadData.success) {
      log.success('Video uploaded to OnlySocial!')
      log.info(`Media ID: ${uploadData.mediaId}`)
      log.info(`Media UUID: ${uploadData.mediaUuid}`)
      log.info(`OnlySocial URL: ${uploadData.mediaUrl}`)
      if (uploadData.thumbUrl) {
        log.info(`Thumbnail: ${uploadData.thumbUrl}`)
      }
    } else {
      log.error('Video upload failed!')
      log.error(`Error: ${uploadData.error || 'Unknown error'}`)
      return
    }

    console.log('')

    // ========================================
    // TEST 3: Crea Post con Media ID
    // ========================================
    log.step(3, 'Testing post creation with uploaded media...')
    log.info(`Caption: ${TEST_CAPTION}`)
    log.info(`Account UUID: ${TEST_ACCOUNT_UUID}`)
    
    const postResponse = await fetch(`${BASE_URL}/api/onlysocial/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: TEST_CAPTION,
        accountUuid: TEST_ACCOUNT_UUID,
        mediaIds: [uploadData.mediaId],
        postType: TEST_POST_TYPE
      })
    })

    const postData = await postResponse.json()

    if (postResponse.ok && postData.postUuid) {
      log.success('Post created successfully!')
      log.info(`Post UUID: ${postData.postUuid}`)
    } else {
      log.error('Post creation failed!')
      log.error(`Error: ${postData.error || 'Unknown error'}`)
      return
    }

    console.log('')

    // ========================================
    // TEST 4: Upload + Post in un'unica chiamata
    // ========================================
    log.step(4, 'Testing combined upload + post...')
    
    const combinedResponse = await fetch(`${BASE_URL}/api/onlysocial/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: `${TEST_CAPTION} (Combined upload)`,
        accountUuid: TEST_ACCOUNT_UUID,
        digitalOceanUrls: [TEST_VIDEO_URL],
        postType: TEST_POST_TYPE
      })
    })

    const combinedData = await combinedResponse.json()

    if (combinedResponse.ok && combinedData.postUuid) {
      log.success('Combined upload + post successful!')
      log.info(`Post UUID: ${combinedData.postUuid}`)
    } else {
      log.error('Combined upload + post failed!')
      log.error(`Error: ${combinedData.error || 'Unknown error'}`)
    }

    console.log('')

    // ========================================
    // RISULTATO FINALE
    // ========================================
    console.log('='.repeat(60))
    log.success('All tests completed successfully! 🎉')
    console.log('='.repeat(60) + '\n')

  } catch (error) {
    console.log('')
    log.error(`Test failed with error: ${error.message}`)
    console.error(error)
  }
}

// Esegui i test
testOnlySocialIntegration()
