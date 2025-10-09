# 🚀 Prossimi Passi - Test Fix Errore 500

## ✅ Cosa Abbiamo Fatto

1. ✅ **Push su GitHub** completato
2. ✅ **Sanitizzazione filename** implementata
3. ✅ **MIME type corretto** implementato
4. ✅ **Logging dettagliato** aggiunto
5. ✅ **Documentazione completa** creata

## 📋 Ora Devi

### 1️⃣ Verifica Deploy Vercel (1-2 minuti)

Vai su: https://vercel.com/dashboard

- Controlla che il deploy sia **in corso** o **completato**
- Verifica che non ci siano errori di build

### 2️⃣ Testa l'Upload (3-5 minuti)

Una volta che Vercel ha finito il deploy:

1. **Vai sulla tua app**
2. **Prova a schedulare un post con video**
3. **Osserva attentamente i log**

### 3️⃣ Analizza i Log

#### ✅ Se Funziona (Log di Successo)

Dovresti vedere:
```
📝 Sanitized filename: nome_file_pulito.mp4
📦 Video downloaded: X.XX MB
   MIME Type: video/mp4
🚀 Uploading to OnlySocial...
   File Type: video/mp4
📡 Response from OnlySocial:
   Status: 200 OK  ← O 201 Created
✅ Video uploaded successfully to OnlySocial!
```

**Azione**: 🎉 SUCCESSO! Il problema è risolto!

#### ❌ Se NON Funziona (Errore 500 Persiste)

Dovresti vedere:
```
📝 Sanitized filename: nome_file_pulito.mp4
📦 Video downloaded: X.XX MB
🚀 Uploading to OnlySocial...
📡 Response from OnlySocial:
   Status: 500 Internal Server Error
   Body: {"message":"Server Error",...}
```

**Azione**: 
1. **Copia TUTTI i log** della richiesta
2. **Verifica API Key** su OnlySocial dashboard
3. **Contatta supporto OnlySocial** con i log

---

## 🔍 Cosa Controllare nei Log

### Informazioni Chiave da Cercare

1. **Filename Sanitizzato**
   ```
   📝 Original URL: ...%23...?X-Amz-Algorithm=...
   📝 Sanitized filename: nome_pulito.mp4
   ```
   - ✅ BUONO: `nome_pulito.mp4` (no caratteri speciali)
   - ❌ MALE: `nome%23file.mp4?param=value`

2. **MIME Type**
   ```
   📦 Video downloaded: 2.62 MB
      MIME Type: video/mp4
   ```
   - ✅ BUONO: `video/mp4`
   - ❌ MALE: `application/octet-stream` o vuoto

3. **Response Status**
   ```
   📡 Response from OnlySocial:
      Status: 200 OK
   ```
   - ✅ BUONO: `200 OK` o `201 Created`
   - ❌ MALE: `500 Internal Server Error`

4. **Response Body**
   Se status è 200/201:
   ```json
   {
     "id": 123,
     "uuid": "xxx-xxx-xxx",
     "url": "https://...",
     "name": "video.mp4",
     "mime_type": "video/mp4"
   }
   ```

   Se status è 500:
   ```json
   {
     "message": "Server Error",
     "errors": {...}  ← Cerca questo per dettagli
   }
   ```

---

## 📊 Scenari Possibili

### Scenario A: ✅ TUTTO OK
**Log**:
```
✅ Video uploaded successfully to OnlySocial!
   Media ID: 123
```

**Cosa fare**: 🎉 Celebra! Tutto funziona!

---

### Scenario B: ❌ Errore 500 con Dettagli
**Log**:
```
❌ OnlySocial API Error: 500 - {
  "message": "Server Error",
  "errors": {
    "file": ["The file must be a video"]
  }
}
```

**Cosa fare**:
1. Analizza il campo `errors`
2. Potrebbe essere un problema di formato video
3. Prova con un altro video

---

### Scenario C: ❌ Errore 500 Generico
**Log**:
```
❌ OnlySocial API Error: 500 - {
  "message": "Server Error"
}
```

**Cosa fare**:
1. **Verifica API Key** su OnlySocial
2. **Testa endpoint** con curl:
   ```bash
   curl -X POST https://app.onlysocial.io/os/api/1d59b252-887e-4a8e-be52-6cafdf3dae2d/media \
     -H "Authorization: Bearer TUA_API_KEY" \
     -H "Accept: application/json" \
     -F "file=@test_video.mp4"
   ```
3. **Contatta supporto OnlySocial**

---

### Scenario D: ❌ Errore 401 (Ritorna)
**Log**:
```
❌ OnlySocial API Error: 401 - {
  "message": "Unauthenticated"
}
```

**Cosa fare**:
1. Controlla che l'endpoint NON abbia trailing slash
2. Verifica API key nelle environment variables
3. Consulta [docs/FIX_401_ERROR.md](./FIX_401_ERROR.md)

---

## 🛠️ Tool di Debug

### 1. Log Vercel
```
Vercel Dashboard → Il tuo progetto → Functions → Logs
```

### 2. Test Locale (Opzionale)
```bash
npm run dev
```

### 3. Test API con curl
```bash
# Test con file locale
curl -X POST https://app.onlysocial.io/os/api/1d59b252-887e-4a8e-be52-6cafdf3dae2d/media \
  -H "Authorization: Bearer D16wCbOhKE5CFXXSq5xHUzRT9YvhSwcaDmI5RofT09707e60" \
  -H "Accept: application/json" \
  -F "file=@video.mp4"
```

---

## 📞 Se Hai Bisogno di Aiuto

### Info da Fornire al Supporto OnlySocial

1. **Workspace UUID**: `1d59b252-887e-4a8e-be52-6cafdf3dae2d`
2. **Endpoint**: `POST /os/api/{workspace}/media`
3. **Filename sanitizzato**: Vedi log
4. **File size**: Vedi log
5. **File MIME type**: Vedi log
6. **Response status**: Vedi log
7. **Response body completo**: Vedi log

### Documenti di Riferimento

- 📚 [FIX_SUMMARY.md](./FIX_SUMMARY.md) - Riepilogo completo
- 🔧 [FIX_500_ERROR.md](./FIX_500_ERROR.md) - Guida errore 500
- 📝 [CHANGELOG_500_FIX.md](./CHANGELOG_500_FIX.md) - Changelog

---

## ⏱️ Timeline

- **0-2 min**: Vercel completa il deploy
- **2-5 min**: Test upload video
- **5-10 min**: Analisi log e verifica

**Total**: ~10 minuti per sapere se il fix funziona

---

## 🎯 Obiettivo

Vedere questo nei log:

```
✅ Video uploaded successfully to OnlySocial!
   Media ID: 123
   Media URL: https://app.onlysocial.io/storage/media/...
```

---

**Buona fortuna! 🍀**

Se funziona, abbiamo risolto sia l'errore 401 che l'errore 500! 🎉
