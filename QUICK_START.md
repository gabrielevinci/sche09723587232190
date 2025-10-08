# 🎯 Quick Start - OnlySocial API Integration

## 📋 TL;DR

L'integrazione OnlySocial è **pronta e funzionante**. Usa questo metodo per programmare video:

```typescript
// Upload video da DigitalOcean + Crea post schedulato
const response = await fetch('/api/onlysocial/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: "Il mio video! 🎥",
    accountUuid: "your-account-uuid",
    digitalOceanUrls: ["https://scheduler-0chiacchiere.lon1.digitaloceanspaces.com/.../video.mp4"],
    scheduleDate: "2025-10-10",
    scheduleTime: "15:30",
    postType: "reel"
  })
})

const { postUuid } = await response.json()
```

---

## 🔑 Variabili d'Ambiente Necessarie

Verifica che siano presenti in `.env.local`:

```bash
ONLYSOCIAL_API_KEY=D16wCbOhKE5CFXXSq5xHUzRT9YvhSwcaDmI5RofT09707e60
ONLYSOCIAL_WORKSPACE_UUID=1d59b252-887e-4a8e-be52-6cafdf3dae2d
```

---

## ✅ Test Veloce

```bash
# 1. Avvia il server
npm run dev

# 2. Testa autenticazione (apri nel browser)
http://localhost:3000/api/onlysocial/accounts

# 3. Se vedi la lista degli account → Tutto OK!
```

---

## 📚 Documentazione Completa

- **Guida dettagliata**: `docs/ONLYSOCIAL_INTEGRATION_GUIDE.md`
- **Riepilogo implementazione**: `IMPLEMENTATION_SUMMARY.md`
- **Integrazione VideoScheduler**: `docs/VIDEO_SCHEDULER_INTEGRATION.md`

---

## 🆘 Troubleshooting

### Errore 401 Unauthenticated
✅ **Risolto!** La nuova implementazione usa endpoint SENZA trailing slash.

### Video non si carica
- Verifica che l'URL DigitalOcean sia pubblicamente accessibile
- Controlla i log del server per dettagli (cerca emoji 📥 🚀 ✅ ❌)

### Account UUID non trovato
```bash
# Ottieni lista account
curl http://localhost:3000/api/onlysocial/accounts
```

---

## 🎬 3 Modi di Usare l'API

### 1️⃣ **Upload + Post in 1 chiamata** (Consigliato)
```typescript
fetch('/api/onlysocial/posts', {
  body: JSON.stringify({
    digitalOceanUrls: ["..."],  // ✅ Usa questo
    // ...
  })
})
```

### 2️⃣ **Upload separato + Post**
```typescript
// Step 1: Upload
const { mediaId } = await fetch('/api/onlysocial/upload-media', {
  body: JSON.stringify({ digitalOceanUrl: "...", videoName: "..." })
})

// Step 2: Post
fetch('/api/onlysocial/posts', {
  body: JSON.stringify({
    mediaIds: [mediaId],  // ✅ Usa l'ID ottenuto
    // ...
  })
})
```

### 3️⃣ **Batch Upload** (Multipli video)
```typescript
fetch('/api/onlysocial/upload-media', {
  method: 'PUT',  // ⚠️ PUT per batch
  body: JSON.stringify({
    videos: [
      { digitalOceanUrl: "...", videoName: "video1.mp4" },
      { digitalOceanUrl: "...", videoName: "video2.mp4" }
    ]
  })
})
```

---

## 🚀 Pronto!

Tutto è configurato e funzionante. Segui la documentazione per dettagli completi.

**Buon lavoro! 🎉**
