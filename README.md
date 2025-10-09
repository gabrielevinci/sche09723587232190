# 📱 Social Media Scheduler - OnlySocial Integration

Un sistema completo per programmare e pubblicare video sui social media tramite OnlySocial API con **Smart Scheduling** per ottimizzare lo spazio di storage.

---

## 🆕 SMART SCHEDULING - Ottimizzazione Spazio OnlySocial

**Problema**: OnlySocial offre solo 20GB di spazio per i video.

**Soluzione**: Sistema intelligente che carica i video su OnlySocial solo quando necessario:
- 🚀 **Video immediati** (< 1 ora): Caricati subito su DigitalOcean + OnlySocial
- ⏰ **Video futuri** (> 1 ora): Caricati solo su DigitalOcean, poi processati automaticamente dal cron job 1 ora prima della pubblicazione

📚 **Guida completa**: [docs/CRON_SETUP_GUIDE.md](./docs/CRON_SETUP_GUIDE.md)

---

## 🔧 ULTIMO FIX: Errore 500 Server Error

**Se stai ricevendo errore 500 Server Error**, le correzioni sono state implementate!

🎯 **Soluzione**: 
- ✅ Filename sanitizzato (rimozione query params e caratteri speciali)
- ✅ MIME type corretto per i video
- ✅ Logging dettagliato per debugging

📚 **Guida completa**: [docs/FIX_500_ERROR.md](./docs/FIX_500_ERROR.md)  
📝 **Changelog**: [docs/CHANGELOG_500_FIX.md](./docs/CHANGELOG_500_FIX.md)

---

## ✅ ERRORE 401 RISOLTO!

**Se stai ricevendo errore 401 Unauthenticated**, le correzioni sono state implementate!

🎯 **Soluzione**: Usa `uploadMediaFromDigitalOcean()` invece di inviare URL direttamente  
📚 **Guida completa**: [docs/FIX_401_ERROR.md](./docs/FIX_401_ERROR.md)  
🧪 **Test fix**: `node scripts/test-401-fix.js`

---ia Scheduler - OnlySocial Integration

Un sistema completo per programmare e pubblicare video sui social media tramite OnlySocial API.

---

## � ERRORE 401 RISOLTO!

**Se stai ricevendo errore 401 Unauthenticated**, le correzioni sono state implementate!

🎯 **Soluzione**: Usa `uploadMediaFromDigitalOcean()` invece di inviare URL direttamente  
📚 **Guida completa**: [docs/FIX_401_ERROR.md](./docs/FIX_401_ERROR.md)  
🧪 **Test fix**: `node scripts/test-401-fix.js`

---

## �🚀 Quick Start

```bash
# 1. Installa dipendenze
npm install

# 2. Configura variabili d'ambiente
cp .env.example .env.local

# 3. Setup database
npx prisma generate
npx prisma db push

# 4. Avvia in sviluppo
npm run dev
```

Visita `http://localhost:3000`

---

## 📋 Caratteristiche

### 🎯 Core Features
✅ **Smart Scheduling** - Caricamento intelligente dei video  
✅ Upload video su DigitalOcean Spaces  
✅ Integrazione completa con OnlySocial API  
✅ **Fix Errori 401 e 500** implementati 🔧  
✅ Programmazione post con calendario  
✅ Supporto Reel, Story e Post  
✅ Gestione multipli account social  

### 🤖 Smart Scheduling System
✅ Caricamento video immediato (< 1 ora) su DO + OnlySocial  
✅ Caricamento video futuro (> 1 ora) solo su DO  
✅ Cron job automatico processa video 1 ora prima  
✅ Database tracking con stati (PENDING → SCHEDULED → PUBLISHED)  
✅ Retry automatico su errori (max 3 tentativi)  
✅ Ottimizzazione spazio OnlySocial (20GB limit)  

### 👥 Admin Features
✅ Dashboard amministrazione  
✅ Sistema autenticazione NextAuth  
✅ Database PostgreSQL con Prisma  

---

## 🎯 Integrazione OnlySocial (✅ COMPLETATA)

L'integrazione con OnlySocial API è stata implementata con successo e risolve il problema dell'errore **401 Unauthenticated**.

### Documenti Chiave

1. **[docs/FIX_401_ERROR.md](./docs/FIX_401_ERROR.md)** - 🔧 **Risoluzione errore 401** (NUOVO!)
2. **[QUICK_START.md](./QUICK_START.md)** - Inizio rapido
3. **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Riepilogo completo
4. **[docs/ONLYSOCIAL_INTEGRATION_GUIDE.md](./docs/ONLYSOCIAL_INTEGRATION_GUIDE.md)** - Guida dettagliata
5. **[docs/VIDEO_SCHEDULER_INTEGRATION.md](./docs/VIDEO_SCHEDULER_INTEGRATION.md)** - Integrazione componenti
5. **[examples/complete-integration-example.tsx](./examples/complete-integration-example.tsx)** - Esempio completo

### Utilizzo Base

```typescript
// Upload video e crea post programmato
const response = await fetch('/api/onlysocial/posts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: "Il mio video! 🎥",
    accountUuid: "your-account-uuid",
    digitalOceanUrls: ["https://your-space.digitaloceanspaces.com/video.mp4"],
    scheduleDate: "2025-10-10",
    scheduleTime: "15:30",
    postType: "reel"
  })
})
```

---

## 🛠️ Stack Tecnologico

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL (NeonDB)
- **ORM**: Prisma
- **Autenticazione**: NextAuth.js
- **Storage**: DigitalOcean Spaces (S3-compatible)
- **Social API**: OnlySocial
- **Styling**: Tailwind CSS
- **TypeScript**: Full type safety

---

## 📁 Struttura Progetto

```
ONLYSOCIAL/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── onlysocial/
│   │   │   │   ├── upload-media/    # ✅ Upload media
│   │   │   │   ├── posts/           # ✅ Crea post
│   │   │   │   └── accounts/        # Lista account
│   │   │   ├── upload/
│   │   │   │   └── videos/          # Upload DigitalOcean
│   │   │   └── schedule/
│   │   │       └── posts/           # Salvataggio DB
│   │   ├── dashboard/
│   │   ├── admin/
│   │   └── login/
│   ├── components/
│   │   ├── VideoSchedulerDrawer.tsx
│   │   └── Providers.tsx
│   └── lib/
│       ├── onlysocial-api.ts        # ✅ Client OnlySocial
│       ├── digitalocean-spaces.ts   # Client DigitalOcean
│       ├── auth.ts
│       └── prisma.ts
├── docs/
│   ├── ONLYSOCIAL_INTEGRATION_GUIDE.md
│   ├── VIDEO_SCHEDULER_INTEGRATION.md
│   └── ...
├── examples/
│   └── complete-integration-example.tsx
├── scripts/
│   ├── test-onlysocial-integration.js
│   └── ...
├── QUICK_START.md
├── IMPLEMENTATION_SUMMARY.md
└── README.md
```

---

## ⚙️ Configurazione

### Variabili d'Ambiente (`.env.local`)

```bash
# NextAuth
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# Database
DATABASE_URL="postgresql://..."

# OnlySocial API
ONLYSOCIAL_API_KEY=your-api-key
ONLYSOCIAL_WORKSPACE_UUID=your-workspace-uuid

# DigitalOcean Spaces
DO_SPACES_ENDPOINT=https://lon1.digitaloceanspaces.com
DO_SPACES_BUCKET=your-bucket-name
DO_SPACES_ACCESS_KEY=your-access-key
DO_SPACES_SECRET_KEY=your-secret-key
DO_SPACES_REGION=lon1
```

---

## 🧪 Testing

### Test Autenticazione OnlySocial

```bash
# Avvia il server
npm run dev

# Test nel browser
http://localhost:3000/api/onlysocial/accounts
```

### Test Completo con Script

```bash
# Aggiorna variabili in scripts/test-onlysocial-integration.js
node scripts/test-onlysocial-integration.js
```

---

## 📚 API Endpoints

### OnlySocial Integration

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/onlysocial/accounts` | GET | Lista account |
| `/api/onlysocial/upload-media` | POST | Upload singolo video |
| `/api/onlysocial/upload-media` | PUT | Batch upload |
| `/api/onlysocial/posts` | GET | Lista post |
| `/api/onlysocial/posts` | POST | Crea post |

### Upload & Storage

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/upload/videos` | POST | Upload su DigitalOcean |
| `/api/upload/presigned-url` | POST | Genera presigned URL |

### Scheduling

| Endpoint | Metodo | Descrizione |
|----------|--------|-------------|
| `/api/schedule/posts` | GET | Lista post programmati |
| `/api/schedule/posts` | POST | Salva post programmato |

---

## 🔒 Autenticazione

Il sistema usa NextAuth.js per l'autenticazione. Utenti possono essere:

- **Admin**: Accesso completo
- **User**: Accesso ai propri account

Crea utenti con:

```bash
node scripts/create-user.js
node scripts/make-admin.js [email]
```

---

## 🎬 Flusso Completo

```
1. Utente carica video
         ↓
2. Upload a DigitalOcean Spaces
   → Ottiene URL pubblico
         ↓
3. Chiamata a /api/onlysocial/posts
   → Passa digitalOceanUrls
         ↓
4. Server scarica video da DigitalOcean
   → Upload su OnlySocial con FormData
         ↓
5. OnlySocial ritorna media ID
         ↓
6. Server crea post programmato
         ↓
7. Post programmato su OnlySocial
   → Ritorna post UUID
         ↓
8. Salvataggio nel database locale
```

---

## 📖 Documentazione Dettagliata

- **[Quick Start Guide](./QUICK_START.md)** - Inizia subito
- **[Implementation Summary](./IMPLEMENTATION_SUMMARY.md)** - Cosa è stato fatto
- **[OnlySocial Integration](./docs/ONLYSOCIAL_INTEGRATION_GUIDE.md)** - Guida completa API
- **[VideoScheduler Integration](./docs/VIDEO_SCHEDULER_INTEGRATION.md)** - Integrazione componenti
- **[Complete Example](./examples/complete-integration-example.tsx)** - Esempio end-to-end

---

## 🐛 Troubleshooting

### Errore 401 Unauthenticated
✅ **Risolto!** L'implementazione attuale usa endpoint SENZA trailing slash.

### Video non si carica
- Verifica URL DigitalOcean pubblicamente accessibile
- Controlla log server (cerca emoji 📥 🚀 ✅ ❌)

### Database errors
```bash
# Resetta il database
npx prisma db push --force-reset
npx prisma generate
```

---

## 🤝 Contribuire

1. Fork il progetto
2. Crea feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri Pull Request

---

## 📝 License

Questo progetto è privato.

---

## 🆘 Supporto

Per problemi o domande:

1. Controlla la documentazione in `/docs`
2. Verifica gli esempi in `/examples`
3. Esamina i log del server (usa emoji per identificare rapidamente i problemi)
4. Contatta il team di sviluppo

---

## ✅ Status

**Progetto**: 🟢 Production Ready  
**OnlySocial Integration**: 🟢 Completata e Testata  
**Ultimo Aggiornamento**: 9 ottobre 2025

---

**Happy Scheduling! 🚀**
