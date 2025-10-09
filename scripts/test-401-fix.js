/**
 * 🧪 TEST RAPIDO - Verifica Correzione Errore 401
 * 
 * Questo script testa se le correzioni per l'errore 401 funzionano.
 * 
 * USO:
 * 1. Assicurati che il server Next.js sia avviato (npm run dev)
 * 2. Configura le variabili TEST_VIDEO_URL e TEST_ACCOUNT_UUID
 * 3. Esegui: node scripts/test-401-fix.js
 */

const BASE_URL = 'http://localhost:3000'

// ⚠️ CONFIGURA QUESTI VALORI
const TEST_VIDEO_URL = 'https://scheduler-0chiacchiere.lon1.digitaloceanspaces.com/user1/profile1/1696666666666/test-video.mp4'
const TEST_ACCOUNT_UUID = 'your-account-uuid-here'

// Colori per output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
}

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  test: (msg) => console.log(`${colors.cyan}🧪${colors.reset} ${msg}`),
  fix: (msg) => console.log(`${colors.magenta}🔧${colors.reset} ${msg}`)
}

async function test401Fix() {
  console.log('\n' + '='.repeat(70))
  console.log('🔧 TEST CORREZIONE ERRORE 401 - OnlySocial API')
  console.log('='.repeat(70) + '\n')

  let hasFailed = false

  try {
    // ========================================
    // TEST 1: Verifica Autenticazione Base
    // ========================================
    log.test('Test 1: Verifica autenticazione OnlySocial...')
    
    const authResponse = await fetch(`${BASE_URL}/api/onlysocial/accounts`)
    
    if (authResponse.status === 401) {
      log.error('Autenticazione fallita! Verifica ONLYSOCIAL_API_KEY')
      log.fix('Controlla .env.local:')
      log.fix('  ONLYSOCIAL_API_KEY=your-api-key')
      log.fix('  ONLYSOCIAL_WORKSPACE_UUID=your-workspace-uuid')
      hasFailed = true
    } else if (authResponse.ok) {
      const data = await authResponse.json()
      log.success('Autenticazione OK!')
      log.info(`  Trovati ${data.data?.length || 0} account`)
    } else {
      log.error(`Errore inatteso: ${authResponse.status}`)
      hasFailed = true
    }

    console.log('')

    // ========================================
    // TEST 2: Upload Media con URL DigitalOcean
    // ========================================
    log.test('Test 2: Upload media da DigitalOcean...')
    log.info(`  Video URL: ${TEST_VIDEO_URL.substring(0, 50)}...`)
    
    const uploadResponse = await fetch(`${BASE_URL}/api/onlysocial/upload-media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        digitalOceanUrl: TEST_VIDEO_URL,
        videoName: 'test-fix-401.mp4',
        altText: 'Test per verifica fix 401'
      })
    })

    const uploadData = await uploadResponse.json()

    if (uploadResponse.status === 401) {
      log.error('❌ ERRORE 401 - Il problema NON è stato risolto!')
      log.error(`  Risposta: ${JSON.stringify(uploadData)}`)
      log.fix('\n🔧 AZIONI CORRETTIVE NECESSARIE:')
      log.fix('1. Verifica che il file src/lib/onlysocial-api.ts sia stato modificato')
      log.fix('2. Controlla che uploadMedia chiami uploadMediaFromDigitalOcean')
      log.fix('3. Verifica che l\'URL non abbia trailing slash (/media non /media/)')
      log.fix('4. Controlla che si usi FormData, non JSON')
      log.fix('5. Riavvia il server Next.js (npm run dev)')
      log.fix('\nConsulta: docs/FIX_401_ERROR.md per dettagli completi')
      hasFailed = true
    } else if (uploadResponse.ok && uploadData.success) {
      log.success('✅ Upload completato! Il fix funziona!')
      log.success(`  Media ID: ${uploadData.mediaId}`)
      log.success(`  Media URL: ${uploadData.mediaUrl}`)
      log.info(`  Thumbnail: ${uploadData.thumbUrl || 'N/A'}`)
      
      // Salva mediaId per test successivo
      global.testMediaId = uploadData.mediaId
    } else {
      log.error(`Errore upload: ${uploadResponse.status}`)
      log.error(`  Messaggio: ${uploadData.error || 'Sconosciuto'}`)
      log.fix('Verifica che l\'URL DigitalOcean sia pubblicamente accessibile')
      hasFailed = true
    }

    console.log('')

    // ========================================
    // TEST 3: Crea Post con Media ID
    // ========================================
    if (global.testMediaId && TEST_ACCOUNT_UUID !== 'your-account-uuid-here') {
      log.test('Test 3: Creazione post con media...')
      
      const postResponse = await fetch(`${BASE_URL}/api/onlysocial/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: 'Test post - Verifica fix 401 🎥',
          accountUuid: TEST_ACCOUNT_UUID,
          mediaIds: [global.testMediaId],
          postType: 'reel'
        })
      })

      const postData = await postResponse.json()

      if (postResponse.ok && postData.postUuid) {
        log.success('Post creato con successo!')
        log.info(`  Post UUID: ${postData.postUuid}`)
      } else {
        log.error(`Errore creazione post: ${postResponse.status}`)
        log.error(`  Messaggio: ${postData.error || 'Sconosciuto'}`)
      }

      console.log('')
    } else {
      log.warning('Test 3 saltato: configura TEST_ACCOUNT_UUID in questo script')
      console.log('')
    }

    // ========================================
    // RISULTATO FINALE
    // ========================================
    console.log('='.repeat(70))
    
    if (!hasFailed) {
      log.success('🎉 TUTTI I TEST PASSATI!')
      log.success('Il problema dell\'errore 401 è stato RISOLTO!')
      console.log('\n✅ Il sistema è pronto per essere usato')
      console.log('✅ Puoi procedere con l\'upload e la programmazione dei video')
    } else {
      log.error('⚠️  ALCUNI TEST FALLITI')
      log.fix('Controlla i messaggi sopra per le azioni correttive')
      log.fix('Consulta docs/FIX_401_ERROR.md per la guida completa')
    }
    
    console.log('='.repeat(70) + '\n')

  } catch (error) {
    console.log('')
    log.error(`Test fallito con errore: ${error.message}`)
    console.error(error)
    
    console.log('')
    log.fix('🔧 POSSIBILI CAUSE:')
    log.fix('1. Server Next.js non è avviato (esegui: npm run dev)')
    log.fix('2. URL DigitalOcean non accessibile')
    log.fix('3. Variabili d\'ambiente non configurate')
    log.fix('4. Problema di rete/connessione')
    console.log('')
  }
}

// Esegui i test
test401Fix()
