# 🎯 GUIDA RAPIDA: Configurazione Sistema Scheduling

## ⚠️ IMPORTANTE: NON usare Vercel Cron (richiede piano Pro)

Usiamo **cron-job.org** che è gratuito e funziona perfettamente!

---

## ✅ SETUP COMPLETO (3 Passi)

### 📋 PASSO 1: Aspetta Deploy Vercel (2-3 minuti)

Dopo ogni `git push`, Vercel fa automaticamente il deploy.

**Come verificare:**
1. Vai su: https://vercel.com/gabrielevincis-projects/sche09723587232190
2. Clicca sulla tab "Deployments"
3. Aspetta che lo stato diventi "Ready" ✅

**Test rapido dopo deploy:**
```powershell
curl.exe https://sche09723587232190.vercel.app/api/cron/process-pending-videos -X POST -H "Authorization: Bearer b0d133f0a9cf8ecabee95b1154e2f53bbd440fe34f057eb6dd1f117fc6714ba2"
```

**Risposta OK:**
```json
{"success":true,"message":"No videos to process","processed":0}
```

**Risposta ERRORE (se deploy non completo):**
```json
{"error":"...videoUrl does not exist..."}
```

---

### 🔧 PASSO 2: Configura Cron-Job.org

Vai su: https://console.cron-job.org/jobs/6686408

#### Modifica il Job Esistente:

**Impostazioni Base:**
- ✅ **Title**: `OnlySocial Scheduler` (o lascia come sta)
- ✅ **URL**: `https://sche09723587232190.vercel.app/api/cron/process-pending-videos`
- ✅ **Request method**: `POST` (importante!)
- ✅ **Schedule**: `*/5 * * * *` (ogni 5 minuti)

**Impostazioni Avanzate (clicca su "Advanced"):**
- ✅ **Headers**: Aggiungi questo header:
  ```
  Authorization: Bearer b0d133f0a9cf8ecabee95b1154e2f53bbd440fe34f057eb6dd1f117fc6714ba2
  ```

**Come aggiungere l'header:**
1. Clicca su "Advanced" o "Headers"
2. Clicca "+ Add header"
3. **Name**: `Authorization`
4. **Value**: `Bearer b0d133f0a9cf8ecabee95b1154e2f53bbd440fe34f057eb6dd1f117fc6714ba2`
5. Clicca "Save"

**⚠️ IMPORTANTE**: 
- URL deve finire con `/process-pending-videos`
- Method deve essere `POST` (non GET)
- Header Authorization è OBBLIGATORIO

---

### 🧪 PASSO 3: Testa il Cron Job

#### Test Manuale (da cron-job.org):
1. Vai nella lista dei job: https://console.cron-job.org/jobs
2. Trova il tuo job "OnlySocial Scheduler"
3. Clicca sul pulsante "▶" (Play) per eseguirlo manualmente
4. Guarda il "Response" - deve dire:
   ```json
   {"success":true,"message":"No videos to process","processed":0}
   ```

#### Test da PowerShell:
```powershell
curl.exe https://sche09723587232190.vercel.app/api/cron/process-pending-videos `
  -X POST `
  -H "Authorization: Bearer b0d133f0a9cf8ecabee95b1154e2f53bbd440fe34f057eb6dd1f117fc6714ba2" `
  -H "Content-Type: application/json"
```

---

## 📊 Come Funziona il Sistema

### Flusso Completo:

```
1. Utente schedula video per le 16:00
   ↓
2. Dashboard salva nel database (status: PENDING)
   ↓
3. Cron job (ogni 5 minuti) controlla:
   - Post PENDING da pubblicare entro 1 ora? → Upload + Crea post → MEDIA_UPLOADED
   - Post MEDIA_UPLOADED da pubblicare ora? → Pubblica → PUBLISHED
   ↓
4. Video pubblicato su Instagram! 🎉
```

### Timing:
- **Cron esegue ogni**: 5 minuti
- **Pre-upload quando**: 1 ora prima della pubblicazione
- **Pubblica quando**: finestra ±5 minuti dall'ora schedulata

---

## 🐛 Risoluzione Problemi

### ❌ Errore: "videoUrl does not exist"
**Causa**: Deploy Vercel non completato  
**Soluzione**: Aspetta 2-3 minuti, riprova il test

### ❌ Errore: "Unauthorized" (401)
**Causa**: Header Authorization mancante o sbagliato  
**Soluzione**: Controlla che l'header sia esattamente:
```
Authorization: Bearer b0d133f0a9cf8ecabee95b1154e2f53bbd440fe34f057eb6dd1f117fc6714ba2
```

### ❌ Cron job non esegue
**Causa 1**: Schedule errato  
**Soluzione**: Usa `*/5 * * * *` per ogni 5 minuti

**Causa 2**: Job disabilitato  
**Soluzione**: Verifica che il toggle "Attiva cronjob" sia ON

### ❌ Video non vengono pubblicati
**Causa**: Nessun video schedulato nel database  
**Soluzione**: Prima schedula un video dal dashboard, poi il cron lo processerà

---

## 📝 Checklist Finale

Prima di testare con video reali:

- [ ] Deploy Vercel completato (Status: Ready)
- [ ] Endpoint `/api/cron/process-pending-videos` risponde con `{"success":true}`
- [ ] Cron-job.org configurato con:
  - [ ] URL corretto (con `/process-pending-videos`)
  - [ ] Method: POST
  - [ ] Header Authorization presente
  - [ ] Schedule: `*/5 * * * *`
- [ ] Test manuale da cron-job.org funziona
- [ ] Job abilitato (toggle ON)

---

## 🎯 Test Finale con Video Reale

1. **Vai sul dashboard**: https://sche09723587232190.vercel.app/dashboard
2. **Carica un video**
3. **Schedula per tra 10 minuti** (esempio: se ora sono le 15:30, schedula per 15:40)
4. **Aspetta che il cron esegua** (max 5 minuti)
5. **Verifica nei log di cron-job.org**: Dovresti vedere "processed: 1"
6. **Controlla OnlySocial**: Video dovrebbe essere pubblicato!

---

## 📞 Serve Aiuto?

**Check logs Vercel**: https://vercel.com/gabrielevincis-projects/sche09723587232190/logs  
**Check logs cron-job.org**: https://console.cron-job.org/jobs/6686408

Se vedi errori, mandami uno screenshot e ti aiuto! 🚀
