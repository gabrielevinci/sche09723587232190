# 📝 Esempio di Integrazione nel VideoSchedulerDrawer

Questo documento mostra come integrare il nuovo sistema di upload OnlySocial nel componente VideoSchedulerDrawer esistente.

## 🔄 Modifica del componente

### 1. Aggiorna la funzione `handleScheduleAll` in `VideoSchedulerDrawer.tsx`

Sostituisci il codice esistente con questa versione aggiornata che usa il nuovo flusso:

```typescript
const handleScheduleAll = async () => {
  if (!hotTableRef.current) return

  const hotInstance = hotTableRef.current.hotInstance
  if (!hotInstance) return

  const tableData = hotInstance.getSourceData() as any[][]
  
  // Validazione e preparazione dati...
  const scheduleRows: ScheduleRow[] = tableData.map((row, index) => {
    const caption = String(row[0] || '')
    const year = Number(row[1])
    const month = Number(row[2])
    const day = Number(row[3])
    const hour = Number(row[4])
    const minute = Number(row[5])
    const postType = String(row[6] || 'reel') as 'reel' | 'story' | 'post'
    const videoName = String(row[7] || '')
    const videoUrl = String(row[9] || '')
    const videoId = String(row[10] || '')

    if (!isValidDate(year, month, day, hour, minute)) {
      throw new Error(`Riga ${index + 1}: Data non valida`)
    }

    if (!caption.trim()) {
      throw new Error(`Riga ${index + 1}: Didascalia mancante`)
    }

    if (!postType) {
      throw new Error(`Riga ${index + 1}: Tipologia post mancante`)
    }

    return {
      id: videoId,
      caption,
      year,
      month,
      day,
      hour,
      minute,
      postType,
      videoId,
      videoName,
      videoUrl  // URL DigitalOcean
    }
  })

  setLoading(true)

  try {
    console.log('📤 Starting OnlySocial scheduling for', scheduleRows.length, 'videos...')

    // Ottieni l'account UUID (dovrebbe essere passato come prop o da context)
    const accountUuid = 'your-account-uuid'  // ⚠️ Ottieni questo da props o state

    // Processa ogni video
    const results = []
    
    for (let i = 0; i < scheduleRows.length; i++) {
      const row = scheduleRows[i]
      const progress = `[${i + 1}/${scheduleRows.length}]`

      try {
        console.log(`${progress} Processing: ${row.videoName}`)

        // Formatta data e ora
        const scheduleDate = `${row.year}-${String(row.month).padStart(2, '0')}-${String(row.day).padStart(2, '0')}`
        const scheduleTime = `${String(row.hour).padStart(2, '0')}:${String(row.minute).padStart(2, '0')}`

        // ✅ NUOVO FLUSSO: Upload + Post in un'unica chiamata
        const response = await fetch('/api/onlysocial/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: row.caption,
            accountUuid: accountUuid,
            digitalOceanUrls: [row.videoUrl],  // Usa l'URL di DigitalOcean
            scheduleDate: scheduleDate,
            scheduleTime: scheduleTime,
            postType: row.postType
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Errore nella creazione del post')
        }

        const result = await response.json()
        
        console.log(`${progress} ✅ Post created: ${result.postUuid}`)
        
        results.push({
          success: true,
          videoName: row.videoName,
          postUuid: result.postUuid,
          scheduledAt: `${scheduleDate} ${scheduleTime}:00`
        })

        // Optional: Salva nel database locale
        await fetch('/api/schedule/posts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            postUuid: result.postUuid,
            videoId: row.videoId,
            videoName: row.videoName,
            videoUrl: row.videoUrl,
            caption: row.caption,
            accountUuid: accountUuid,
            scheduledAt: `${scheduleDate} ${scheduleTime}:00`,
            postType: row.postType
          })
        })

      } catch (error) {
        console.error(`${progress} ❌ Error:`, error)
        results.push({
          success: false,
          videoName: row.videoName,
          error: error.message
        })
      }
    }

    // Mostra risultati
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    console.log(`\n✅ Completed: ${successCount}/${scheduleRows.length} posts scheduled`)
    if (failCount > 0) {
      console.log(`❌ Failed: ${failCount}`)
      const failedVideos = results.filter(r => !r.success).map(r => r.videoName).join(', ')
      console.log(`Failed videos: ${failedVideos}`)
    }

    // Mostra alert all'utente
    alert(`Programmazione completata!\n\n✅ Successi: ${successCount}\n❌ Errori: ${failCount}`)

    // Chiudi il drawer
    if (successCount > 0) {
      setIsOpen(false)
    }

  } catch (error) {
    console.error('❌ Scheduling error:', error)
    alert(`Errore durante la programmazione: ${error.message}`)
  } finally {
    setLoading(false)
  }
}
```

## 🎯 Punti Chiave

### 1. **URL DigitalOcean viene usato direttamente**
Non serve più scaricare e ricaricare il video manualmente - l'API route lo fa automaticamente.

### 2. **Un'unica chiamata API**
Invece di:
1. Upload media
2. Ottieni media ID
3. Crea post

Ora è:
1. Crea post con `digitalOceanUrls`

### 3. **Gestione errori migliorata**
Ogni video viene processato indipendentemente, quindi se uno fallisce gli altri continuano.

### 4. **Salvataggio database**
Salva il `postUuid` nel database per tracking futuro.

## 📊 Props da aggiungere al componente

```typescript
interface VideoSchedulerDrawerProps {
  videos: VideoFile[]
  accountUuid: string  // ✅ AGGIUNTO: UUID dell'account OnlySocial
  onSchedule: (scheduleData: ScheduleRow[]) => Promise<void>
}
```

## 🔄 Utilizzo nel parent component

```typescript
// In dashboard page o altro componente parent
<VideoSchedulerDrawer 
  videos={uploadedVideos}
  accountUuid={selectedAccount.uuid}  // ✅ Passa l'UUID dell'account
  onSchedule={handleScheduleComplete}
/>
```

## 🎉 Vantaggi

✅ **Più veloce** - Un solo flusso invece di due  
✅ **Più semplice** - Meno codice da gestire  
✅ **Più robusto** - Gestione errori integrata  
✅ **Più affidabile** - Usa il metodo corretto senza trailing slash  
✅ **Più tracciabile** - Log dettagliati con emoji  

## 🔧 Testing

Testa con un singolo video prima di processare batch grandi:

```typescript
// Test mode: processa solo il primo video
const testMode = true
const scheduleRows = testMode ? tableData.slice(0, 1) : tableData
```

---

**Pronto per essere integrato!** 🚀
