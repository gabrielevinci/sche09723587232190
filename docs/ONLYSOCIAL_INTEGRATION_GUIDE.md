# 🎯 Integrazione OnlySocial API - Guida Completa

## ✅ IMPLEMENTAZIONE COMPLETATA

L'integrazione con OnlySocial API è stata completata con successo seguendo le best practices per evitare l'errore 401 Unauthenticated.

---

## 📋 COSA È STATO IMPLEMENTATO

### 1. **Metodo Corretto per Upload Media** (`onlysocial-api.ts`)

✅ **Nuovo metodo `uploadMediaFromDigitalOcean`**:
- Scarica il video da DigitalOcean Spaces
- Usa **multipart/form-data** con FormData
- Endpoint **SENZA trailing slash** (evita redirect)
- Headers corretti: `Authorization` + `Accept` (NO Content-Type)
- Gestisce correttamente i status code 200 e 201

```typescript
await api.uploadMediaFromDigitalOcean(
  digitalOceanUrl,  // URL pubblico da DigitalOcean
  videoName,        // Nome file (es. "video.mp4")
  altText           // Descrizione opzionale
)
```

### 2. **Metodo Ottimizzato per Creare Post** (`onlysocial-api.ts`)

✅ **Nuovo metodo `createPostWithMediaIds`**:
- Accetta media IDs già caricati
- Evita doppi upload
- Migliori performance

```typescript
await api.createPostWithMediaIds(
  accountUuid,   // UUID account social
  caption,       // Testo del post
  mediaIds,      // Array di ID media già caricati
  scheduleDate,  // "YYYY-MM-DD" opzionale
  scheduleTime,  // "HH:MM" opzionale
  postType       // "reel", "story", "post"
)
```

### 3. **API Route per Upload Media** (`/api/onlysocial/upload-media`)

✅ **Endpoint dedicato per caricare video**:
- `POST` - Upload singolo video
- `PUT` - Batch upload multipli video

### 4. **API Route Aggiornata per Post** (`/api/onlysocial/posts`)

✅ **Supporta 3 modalità di caricamento**:
1. **Media IDs** (più veloce) - media già caricati
2. **DigitalOcean URLs** (consigliato) - carica automaticamente
3. **Media URLs** (legacy) - compatibilità con codice vecchio

---

## 🚀 FLUSSO DI UTILIZZO

### **Modalità 1: Upload + Post in un'unica chiamata** (Consigliata)

Usa questa modalità quando hai già l'URL DigitalOcean e vuoi creare il post direttamente.

```typescript
// Frontend o API call
const response = await fetch('/api/onlysocial/posts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    content: "Guarda questo video! 🎥 #reel #viral",
    accountUuid: "abc-123-def-456",  // UUID dell'account OnlySocial
    digitalOceanUrls: [
      "https://scheduler-0chiacchiere.lon1.digitaloceanspaces.com/user1/profile1/1696666666666/video.mp4"
    ],
    scheduleDate: "2025-10-10",
    scheduleTime: "15:30",
    postType: "reel"
  })
})

const result = await response.json()
console.log('Post UUID:', result.postUuid)
```

**Cosa succede dietro le quinte:**
1. L'API route riceve l'URL DigitalOcean
2. Chiama `uploadMediaFromDigitalOcean` per ogni video
3. Ottiene i media IDs da OnlySocial
4. Crea il post con `createPostWithMediaIds`
5. Ritorna il UUID del post creato

---

### **Modalità 2: Upload separato + Post** (Più controllo)

Usa questa modalità quando vuoi gestire l'upload separatamente.

#### Step 1: Upload video

```typescript
// Upload video singolo
const uploadResponse = await fetch('/api/onlysocial/upload-media', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    digitalOceanUrl: "https://scheduler-0chiacchiere.lon1.digitaloceanspaces.com/.../video.mp4",
    videoName: "video.mp4",
    altText: "Video caricato il 9 ottobre 2025"
  })
})

const uploadResult = await uploadResponse.json()
console.log('Media ID:', uploadResult.mediaId)
console.log('Media URL OnlySocial:', uploadResult.mediaUrl)
console.log('Thumbnail:', uploadResult.thumbUrl)

// Salva mediaId nel database per uso futuro
```

#### Step 2: Crea post con media ID

```typescript
const postResponse = await fetch('/api/onlysocial/posts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    content: "Nuovo video! 🔥",
    accountUuid: "abc-123-def-456",
    mediaIds: [uploadResult.mediaId],  // Usa l'ID ottenuto prima
    scheduleDate: "2025-10-10",
    scheduleTime: "18:00",
    postType: "reel"
  })
})

const postResult = await postResponse.json()
console.log('Post UUID:', postResult.postUuid)
```

---

### **Modalità 3: Batch Upload** (Per multipli video)

```typescript
const batchResponse = await fetch('/api/onlysocial/upload-media', {
  method: 'PUT',  // ⚠️ PUT per batch!
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    videos: [
      {
        digitalOceanUrl: "https://.../video1.mp4",
        videoName: "video1.mp4",
        altText: "Primo video"
      },
      {
        digitalOceanUrl: "https://.../video2.mp4",
        videoName: "video2.mp4",
        altText: "Secondo video"
      },
      {
        digitalOceanUrl: "https://.../video3.mp4",
        videoName: "video3.mp4",
        altText: "Terzo video"
      }
    ]
  })
})

const batchResult = await batchResponse.json()
console.log(`Upload completati: ${batchResult.successCount}/${batchResult.totalVideos}`)
console.log('Media IDs:', batchResult.successes.map(s => s.mediaId))
```

---

## 📊 FORMATO RISPOSTE API

### **Upload Media - Success Response**

```json
{
  "success": true,
  "mediaId": 785492,
  "mediaUuid": "c10249e2-5c8b-462c-a61f-73e9aec8fcbd",
  "mediaUrl": "https://storage.onlysocial.io/workspace-uuid/uploads/10-2025/video.mp4",
  "thumbUrl": "https://storage.onlysocial.io/workspace-uuid/uploads/10-2025/thumb.jpg",
  "mimeType": "video/mp4",
  "type": "video",
  "isVideo": true,
  "data": { /* full media object */ }
}
```

### **Create Post - Success Response**

```json
{
  "postUuid": "post-uuid-123-456",
  "post": { /* full post object */ }
}
```

### **Error Response**

```json
{
  "success": false,
  "error": "Messaggio di errore dettagliato"
}
```

---

## 🛠️ INTEGRAZIONE NEL TUO CODICE

### **Esempio Completo: Component React**

```tsx
'use client'

import { useState } from 'react'

export default function VideoUploader() {
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)
  
  const handleScheduleVideo = async (
    videoFile: File,
    caption: string,
    accountUuid: string,
    scheduleDate: string,
    scheduleTime: string,
    postType: 'reel' | 'story' | 'post'
  ) => {
    setUploading(true)
    setStatus('📤 Caricamento su DigitalOcean...')
    
    try {
      // Step 1: Upload su DigitalOcean Spaces (già implementato nel tuo progetto)
      const formData = new FormData()
      formData.append('video', videoFile)
      formData.append('profileId', accountUuid)
      
      const uploadDOResponse = await fetch('/api/upload/videos', {
        method: 'POST',
        body: formData
      })
      
      if (!uploadDOResponse.ok) {
        throw new Error('Errore upload DigitalOcean')
      }
      
      const uploadDOResult = await uploadDOResponse.json()
      const digitalOceanUrl = uploadDOResult.videos[0].url
      
      setStatus('✅ Caricato su DigitalOcean!')
      
      // Step 2: Crea post su OnlySocial (carica automaticamente da DigitalOcean)
      setStatus('📤 Creazione post su OnlySocial...')
      
      const createPostResponse = await fetch('/api/onlysocial/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: caption,
          accountUuid: accountUuid,
          digitalOceanUrls: [digitalOceanUrl],
          scheduleDate: scheduleDate,
          scheduleTime: scheduleTime,
          postType: postType
        })
      })
      
      if (!createPostResponse.ok) {
        throw new Error('Errore creazione post OnlySocial')
      }
      
      const createPostResult = await createPostResponse.json()
      
      setStatus(`✅ Post programmato con successo! UUID: ${createPostResult.postUuid}`)
      
      // Optional: Salva nel database locale per tracking
      await fetch('/api/schedule/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          postUuid: createPostResult.postUuid,
          digitalOceanUrl: digitalOceanUrl,
          caption: caption,
          scheduledAt: `${scheduleDate} ${scheduleTime}:00`,
          postType: postType
        })
      })
      
    } catch (error) {
      console.error('Errore:', error)
      setStatus(`❌ Errore: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }
  
  return (
    <div>
      <h2>Programma Video</h2>
      <p>{status}</p>
      {uploading && <p>Caricamento in corso...</p>}
    </div>
  )
}
```

---

## 🔍 DEBUG E TESTING

### **Test Autenticazione OnlySocial**

```typescript
// src/app/api/test-onlysocial/route.ts
import { NextResponse } from 'next/server'
import { OnlySocialAPI } from '@/lib/onlysocial-api'

export async function GET() {
  const token = process.env.ONLYSOCIAL_API_KEY
  const workspaceUuid = process.env.ONLYSOCIAL_WORKSPACE_UUID
  
  if (!token || !workspaceUuid) {
    return NextResponse.json({ error: 'Config mancante' }, { status: 500 })
  }
  
  const api = new OnlySocialAPI({ token, workspaceUuid })
  
  try {
    const accounts = await api.listAccounts()
    return NextResponse.json({ 
      success: true, 
      message: 'Autenticazione OK!',
      accounts 
    })
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
```

Visita: `http://localhost:3000/api/test-onlysocial`

---

## ⚠️ PUNTI CRITICI DA RICORDARE

### 1. **URL Endpoint OnlySocial**

```typescript
// ❌ SBAGLIATO - Con trailing slash → 401 Unauthenticated
const url = `https://app.onlysocial.io/os/api/${workspaceUuid}/media/`

// ✅ CORRETTO - Senza trailing slash
const url = `https://app.onlysocial.io/os/api/${workspaceUuid}/media`
```

### 2. **Headers con FormData**

```typescript
// ✅ CORRETTO
headers: {
  'Authorization': `Bearer ${token}`,
  'Accept': 'application/json'
  // NO Content-Type - FormData lo gestisce!
}

// ❌ SBAGLIATO
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'  // ❌ NO!
}
```

### 3. **Status Code**

```typescript
// Controlla ENTRAMBI i codici
if (response.status === 200 || response.status === 201) {
  // Success!
}
```

### 4. **Formato Media IDs nel Post**

```typescript
// OnlySocial si aspetta stringhe, non numeri
media: mediaIds.map(id => String(id))
```

---

## 📚 VARIABILI D'AMBIENTE NECESSARIE

Assicurati di avere queste variabili nel file `.env.local`:

```bash
# OnlySocial API
ONLYSOCIAL_API_KEY=D16wCbOhKE5CFXXSq5xHUzRT9YvhSwcaDmI5RofT09707e60
ONLYSOCIAL_WORKSPACE_UUID=1d59b252-887e-4a8e-be52-6cafdf3dae2d

# DigitalOcean Spaces
DO_SPACES_ENDPOINT=https://lon1.digitaloceanspaces.com
DO_SPACES_BUCKET=scheduler-0chiacchiere
DO_SPACES_ACCESS_KEY=DO00WECDB3PZ8T4KQNCV
DO_SPACES_SECRET_KEY=kP6wBcl1epRJtsmaxB+PKAUZfqYXadJp30YVRBE7jog
DO_SPACES_REGION=lon1
```

---

## 🎬 FLUSSO COMPLETO VISUALE

```
1. UTENTE carica video
         ↓
2. UPLOAD a DigitalOcean Spaces
   → Ottiene URL pubblico
         ↓
3. CHIAMATA a /api/onlysocial/posts
   → Passa digitalOceanUrls
         ↓
4. API ROUTE scarica video da DigitalOcean
   → Usa uploadMediaFromDigitalOcean
         ↓
5. ONLYSOCIAL riceve video con FormData
   → Ritorna media ID
         ↓
6. API ROUTE crea post
   → Usa createPostWithMediaIds
         ↓
7. POST PROGRAMMATO su OnlySocial
   → Ritorna post UUID
         ↓
8. SALVA nel database locale
   → Per tracking e reporting
```

---

## ✅ CHECKLIST FINALE

- [x] Variabili d'ambiente configurate
- [x] Metodo `uploadMediaFromDigitalOcean` implementato
- [x] Metodo `createPostWithMediaIds` implementato
- [x] API route `/api/onlysocial/upload-media` creata
- [x] API route `/api/onlysocial/posts` aggiornata
- [x] Supporto batch upload
- [x] Gestione errori completa
- [x] Logging dettagliato
- [x] Documentazione completa

---

## 🚀 READY TO USE!

L'integrazione è completa e pronta per essere utilizzata. Segui uno dei flussi documentati sopra per iniziare a programmare i tuoi video su OnlySocial!

Per domande o problemi, controlla i log del server per messaggi dettagliati con emoji:
- 📥 = Download da DigitalOcean
- 📦 = Video scaricato
- 🚀 = Upload a OnlySocial
- ✅ = Successo
- ❌ = Errore
- 📝 = Creazione post

---

**Data implementazione**: 9 ottobre 2025  
**Versione**: 1.0.0  
**Status**: ✅ Production Ready
