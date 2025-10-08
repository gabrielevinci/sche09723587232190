# 🎥 Upload Video - Come Funziona

## 🔄 Nuovo Sistema: Upload Diretto

Per bypassare il limite di **4.5MB** di Vercel, abbiamo implementato un sistema di **upload diretto** da browser a DigitalOcean Spaces.

### Come Funziona

```
┌─────────┐           ┌─────────┐           ┌────────────────┐
│ Browser │           │ Vercel  │           │ DigitalOcean   │
│         │           │ API     │           │ Spaces         │
└────┬────┘           └────┬────┘           └────────┬───────┘
     │                     │                         │
     │  1. Richiedi URL    │                         │
     │────────────────────>│                         │
     │                     │                         │
     │                     │  2. Genera Presigned    │
     │                     │     URL (firmato)       │
     │                     │─────────────────────────>│
     │                     │                         │
     │  3. URL firmato     │                         │
     │<────────────────────│                         │
     │                     │                         │
     │  4. Upload diretto (PUT)                      │
     │   con file video (anche 500MB!)              │
     │───────────────────────────────────────────────>│
     │                     │                         │
     │  5. Success 200     │                         │
     │<───────────────────────────────────────────────│
     │                     │                         │
```

### Vantaggi

✅ **Nessun limite di dimensione file** (teoricamente fino a 5GB per DigitalOcean)
✅ **Più veloce**: upload diretto, non passa per Vercel
✅ **Più sicuro**: URL firmato valido solo 10 minuti
✅ **Scalabile**: ogni video caricato indipendentemente

## 🔐 Sicurezza

### Presigned URL

Un **presigned URL** è un URL temporaneo e firmato che permette:
- ✅ Upload **senza credenziali** nel browser
- ✅ Accesso **limitato nel tempo** (10 minuti)
- ✅ Permessi **specifici** (solo PUT per quel file)
- ❌ **Non può** essere riutilizzato per altri file

### Esempio

```
https://scheduler-0chiacchiere.lon1.digitaloceanspaces.com/
  userId/profileId/2025-01-15T10-30-00/video.mp4
  ?X-Amz-Algorithm=AWS4-HMAC-SHA256
  &X-Amz-Credential=DO00...%2Flon1%2Fs3%2Faws4_request
  &X-Amz-Date=20250115T103000Z
  &X-Amz-Expires=600
  &X-Amz-SignedHeaders=host
  &X-Amz-Signature=abc123...
```

Dopo 10 minuti, la firma scade e l'URL diventa inutilizzabile.

## 📁 Struttura File

I video vengono salvati con questa struttura:

```
/userId/profileId/timestamp/filename.mp4
```

Esempio reale:
```
/cmgaayfyp0000jm04cakmwph4/
  cm0abc123xyz/
    2025-01-15T10-30-00-123Z/
      video-01.mp4
      video-02.mp4
      video-03.mp4
```

### Timestamp

Il timestamp è in formato ISO 8601 con caratteri sicuri:
- `2025-01-15T10:30:00.123Z` → `2025-01-15T10-30-00-123Z`
- Sostituisce `:` e `.` con `-`
- Unico per ogni batch di upload

## 🛠️ Endpoint API

### POST /api/upload/presigned-url

Genera un presigned URL per upload diretto.

#### Request

```json
{
  "profileId": "cm0abc123xyz",
  "fileName": "video.mp4",
  "fileSize": 52428800,
  "fileType": "video/mp4"
}
```

#### Response

```json
{
  "presignedUrl": "https://scheduler-0chiacchiere.lon1.digitaloceanspaces.com/...",
  "publicUrl": "https://scheduler-0chiacchiere.lon1.digitaloceanspaces.com/userId/profileId/timestamp/video.mp4",
  "key": "userId/profileId/timestamp/video.mp4",
  "expiresIn": 600
}
```

#### Verifica Permessi

L'endpoint verifica:
1. ✅ Utente autenticato
2. ✅ Profilo esiste
3. ✅ Utente ha accesso al profilo (AdminAssociation)

## 💻 Codice Client

```typescript
// 1. Richiedi presigned URL
const presignedRes = await fetch('/api/upload/presigned-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    profileId: selectedProfile.id,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || 'video/mp4',
  }),
})

const { presignedUrl, publicUrl } = await presignedRes.json()

// 2. Upload diretto a DigitalOcean
const uploadRes = await fetch(presignedUrl, {
  method: 'PUT',
  body: file,
  headers: {
    'Content-Type': file.type || 'video/mp4',
  },
})

// 3. Usa publicUrl per scheduling
console.log('Video disponibile su:', publicUrl)
```

## 🎨 UI: Sfondo Sfocato

Il modal ora usa uno **sfondo sfocato** invece del grigio opaco:

```css
backdrop-blur-sm bg-black/30
```

- `backdrop-blur-sm`: Sfoca il contenuto sotto
- `bg-black/30`: Overlay nero al 30% di opacità

## 🐛 Troubleshooting

### Errore: 403 Forbidden

**Causa**: CORS non configurato correttamente su DigitalOcean

**Soluzione**:
1. Vai al tuo Space su DigitalOcean
2. Settings → CORS Configurations
3. Aggiungi origine: `https://sche09723587232190.vercel.app`
4. Metodi: `PUT` (per upload), `GET`, `HEAD`

### Errore: 413 Content Too Large

**Causa**: Stai usando il vecchio endpoint `/api/upload/videos`

**Soluzione**: Il nuovo sistema non ha questo problema, usa presigned URLs

### Upload Lento

**Causa**: Dipende dalla tua connessione internet

**Info**: 
- 10 MB/s → 100MB in 10 secondi
- 1 MB/s → 100MB in 100 secondi

### Video Non Visibile

**Causa**: CORS o ACL non configurato

**Verifica**:
1. Apri il `publicUrl` in una nuova tab
2. Se vedi "Access Denied" → problema ACL/CORS
3. Se vedi il video → tutto OK

## 📊 Limiti

### DigitalOcean Spaces

- **File singolo**: fino a 5GB
- **Request size**: fino a 5GB
- **Presigned URL**: valido 10 minuti (configurabile)

### Vercel (ora bypassato)

- ~~Request body: 4.5MB~~ ✅ Non più un problema!
- Function timeout: 5 minuti (Free), 5 minuti (Hobby), 5 minuti (Pro)
- Function size: 50MB

## 🔄 Migrazione dal Vecchio Sistema

### Prima (con limite 4.5MB)

```
Browser → [Upload 4.5MB] → Vercel → DigitalOcean
         ❌ ERRORE 413
```

### Dopo (nessun limite)

```
Browser → [Richiedi URL] → Vercel
Browser → [Upload diretto 500MB] → DigitalOcean
         ✅ SUCCESS
```

## 🎯 Best Practices

1. **Compressione**: Comprimi i video prima dell'upload quando possibile
2. **Formato**: Preferisci MP4 (H.264) per massima compatibilità
3. **Dimensione**: Tieni sotto 100MB per upload più veloci
4. **Timeout**: Upload completato entro 10 minuti (scadenza presigned URL)
5. **Retry**: Implementa retry logic per upload falliti

## 🆘 Support

In caso di problemi con l'upload:

1. **Controlla Console Browser** (F12 → Console)
   - Cerca errori con emoji 📤 ❌
   - Verifica status delle richieste

2. **Verifica CORS su DigitalOcean**
   - Origin deve includere `https://`
   - Metodi: GET, HEAD, PUT

3. **Testa Presigned URL**
   - Copia URL dalla console
   - Testa con `curl -X PUT --upload-file video.mp4 "<presigned_url>"`

4. **Controlla Log Vercel**
   - https://vercel.com/gabrielevinci/sche09723587232190/logs
   - Cerca errori nella generazione presigned URL
