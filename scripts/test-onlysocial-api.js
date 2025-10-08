/**
 * Script di test per OnlySocial API
 * Testa l'autenticazione e le chiamate base
 */

require('dotenv').config({ path: '.env.local' })

const API_KEY = process.env.ONLYSOCIAL_API_KEY
const WORKSPACE_UUID = process.env.ONLYSOCIAL_WORKSPACE_UUID
const BASE_URL = `https://app.onlysocial.io/os/api/${WORKSPACE_UUID}`

console.log('🔧 TEST ONLYSOCIAL API\n')
console.log('📋 Configurazione:')
console.log(`   Base URL: ${BASE_URL}`)
console.log(`   API Key: ${API_KEY ? API_KEY.substring(0, 10) + '...' : 'MISSING'}`)
console.log(`   Workspace: ${WORKSPACE_UUID}\n`)

// Test 1: Lista degli account social
async function testListAccounts() {
  console.log('📡 Test 1: Lista account social...')
  
  try {
    const response = await fetch(`${BASE_URL}/accounts/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    console.log(`   Status: ${response.status} ${response.statusText}`)
    
    if (response.ok) {
      const data = await response.json()
      console.log('   ✅ Successo!')
      console.log(`   Trovati ${data.data?.length || 0} account:`)
      if (data.data && data.data.length > 0) {
        data.data.forEach((account, i) => {
          console.log(`      ${i + 1}. ${account.social_network} - ${account.username} (ID: ${account.id})`)
        })
      }
      return { success: true, accounts: data.data }
    } else {
      const error = await response.text()
      console.log(`   ❌ Errore: ${error}`)
      return { success: false, error }
    }
  } catch (error) {
    console.log(`   ❌ Errore di rete: ${error.message}`)
    return { success: false, error: error.message }
  }
}

// Test 2: Upload di un media (con URL di test)
async function testUploadMedia() {
  console.log('\n📡 Test 2: Upload media...')
  
  // URL di test pubblico (un video di esempio)
  const testVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
  
  console.log(`   URL video test: ${testVideoUrl}`)
  
  try {
    const response = await fetch(`${BASE_URL}/media/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: testVideoUrl,
        alt_text: 'Test video from API script'
      })
    })

    console.log(`   Status: ${response.status} ${response.statusText}`)
    
    if (response.ok) {
      const data = await response.json()
      console.log('   ✅ Successo!')
      console.log(`   Media ID: ${data.data?.id}`)
      console.log(`   URL: ${data.data?.url || 'N/A'}`)
      return { success: true, mediaId: data.data?.id }
    } else {
      const error = await response.text()
      console.log(`   ❌ Errore: ${error}`)
      return { success: false, error }
    }
  } catch (error) {
    console.log(`   ❌ Errore di rete: ${error.message}`)
    return { success: false, error: error.message }
  }
}

// Test 3: Lista dei post
async function testListPosts() {
  console.log('\n📡 Test 3: Lista post...')
  
  try {
    const response = await fetch(`${BASE_URL}/posts/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    console.log(`   Status: ${response.status} ${response.statusText}`)
    
    if (response.ok) {
      const data = await response.json()
      console.log('   ✅ Successo!')
      console.log(`   Trovati ${data.data?.length || 0} post`)
      if (data.data && data.data.length > 0) {
        console.log('   Ultimi 3 post:')
        data.data.slice(0, 3).forEach((post, i) => {
          console.log(`      ${i + 1}. ${post.caption?.substring(0, 50)}... (${post.status})`)
        })
      }
      return { success: true, posts: data.data }
    } else {
      const error = await response.text()
      console.log(`   ❌ Errore: ${error}`)
      return { success: false, error }
    }
  } catch (error) {
    console.log(`   ❌ Errore di rete: ${error.message}`)
    return { success: false, error: error.message }
  }
}

// Esegui tutti i test
async function runAllTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  
  if (!API_KEY || !WORKSPACE_UUID) {
    console.log('❌ ERRORE: API_KEY o WORKSPACE_UUID mancanti in .env.local')
    process.exit(1)
  }

  const accountsResult = await testListAccounts()
  const mediaResult = await testUploadMedia()
  const postsResult = await testListPosts()

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n📊 RIEPILOGO TEST:\n')
  console.log(`   Lista Account: ${accountsResult.success ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`   Upload Media:  ${mediaResult.success ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`   Lista Post:    ${postsResult.success ? '✅ PASS' : '❌ FAIL'}`)

  const allPassed = accountsResult.success && mediaResult.success && postsResult.success
  
  console.log(`\n   Risultato: ${allPassed ? '✅ TUTTI I TEST PASSATI' : '❌ ALCUNI TEST FALLITI'}`)
  
  if (!allPassed) {
    console.log('\n💡 SUGGERIMENTI:')
    if (!accountsResult.success) {
      console.log('   - Verifica che l\'API Key sia corretta')
      console.log('   - Verifica che il Workspace UUID sia corretto')
      console.log('   - Controlla che l\'API Key non sia scaduta')
    }
    if (!mediaResult.success) {
      console.log('   - L\'upload media potrebbe richiedere URL pubblici accessibili')
      console.log('   - Verifica i permessi dell\'API Key per upload media')
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

// Avvia i test
runAllTests().catch(console.error)
