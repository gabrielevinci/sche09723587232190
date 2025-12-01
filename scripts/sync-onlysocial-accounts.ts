/**
 * Script per sincronizzare gli account OnlySocial
 * Popola accountUuid per tutti gli account esistenti nel database
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface OnlySocialAccount {
  id: number
  uuid: string
  username: string
  profile_name: string
  platform: string
  // altri campi...
}

async function syncAccounts() {
  console.log('🔄 Sincronizzazione account OnlySocial...')

  const apiKey = process.env.ONLYSOCIAL_API_KEY
  const workspaceUuid = process.env.ONLYSOCIAL_WORKSPACE_UUID

  if (!apiKey || !workspaceUuid) {
    console.error('❌ ONLYSOCIAL_API_KEY o ONLYSOCIAL_WORKSPACE_UUID non configurati')
    process.exit(1)
  }

  try {
    // 1. Recupera tutti gli account dal database
    const dbAccounts = await prisma.socialAccount.findMany({
      select: {
        id: true,
        accountId: true,
        accountUuid: true,
        accountName: true,
        platform: true,
      },
    })

    console.log(`📊 Trovati ${dbAccounts.length} account nel database`)

    // 2. Recupera tutti gli account dall'API OnlySocial
    console.log('🌐 Recupero account da OnlySocial API...')
    const response = await fetch(
      `https://app.onlysocial.io/os/api/${workspaceUuid}/accounts`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error: ${response.status} - ${errorText}`)
    }

    const apiData = await response.json()
    const apiAccounts: OnlySocialAccount[] = apiData.data || []

    console.log(`📊 Trovati ${apiAccounts.length} account su OnlySocial`)

    // 3. Crea mappe per matching veloce (sia per ID che per UUID)
    const apiAccountsByUuid = new Map<string, OnlySocialAccount>()
    const apiAccountsById = new Map<string, OnlySocialAccount>()
    apiAccounts.forEach(acc => {
      apiAccountsByUuid.set(acc.uuid, acc)
      apiAccountsById.set(acc.id.toString(), acc)
    })

    // 4. Aggiorna ogni account del database
    let updated = 0
    let skipped = 0
    let notFound = 0

    for (const dbAccount of dbAccounts) {
      // Prova prima a matchare per UUID (accountId potrebbe contenere l'UUID)
      let apiAccount = apiAccountsByUuid.get(dbAccount.accountId)
      
      // Se non trova, prova con ID numerico
      if (!apiAccount) {
        apiAccount = apiAccountsById.get(dbAccount.accountId)
      }

      if (!apiAccount) {
        console.log(`⚠️  Account non trovato su OnlySocial: ${dbAccount.accountName} (accountId DB: ${dbAccount.accountId})`)
        notFound++
        continue
      }

      // Se accountUuid è già popolato e corrisponde, salta
      if (dbAccount.accountUuid === apiAccount.uuid) {
        console.log(`⏭️  Account già sincronizzato: ${dbAccount.accountName}`)
        skipped++
        continue
      }

      // Aggiorna con i dati corretti dall'API
      await prisma.socialAccount.update({
        where: { id: dbAccount.id },
        data: {
          accountId: apiAccount.id.toString(), // Salva ID numerico come stringa
          accountUuid: apiAccount.uuid,
        },
      })

      console.log(`✅ Aggiornato: ${dbAccount.accountName}`)
      console.log(`   accountId: ${dbAccount.accountId} → ${apiAccount.id}`)
      console.log(`   accountUuid: ${dbAccount.accountUuid || '(vuoto)'} → ${apiAccount.uuid}`)
      updated++
    }

    console.log('\n📊 Riepilogo:')
    console.log(`   ✅ Aggiornati: ${updated}`)
    console.log(`   ⏭️  Già sincronizzati: ${skipped}`)
    console.log(`   ⚠️  Non trovati su OnlySocial: ${notFound}`)
    console.log(`   📊 Totale: ${dbAccounts.length}`)

    // 5. Verifica finale
    const stillMissing = await prisma.socialAccount.count({
      where: {
        accountUuid: null,
      },
    })

    if (stillMissing > 0) {
      console.log(`\n⚠️  Attenzione: ${stillMissing} account non hanno ancora accountUuid`)
    } else {
      console.log('\n✅ Tutti gli account sono sincronizzati!')
    }

  } catch (error) {
    console.error('❌ Errore durante la sincronizzazione:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

syncAccounts()
