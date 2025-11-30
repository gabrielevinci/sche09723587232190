# 📝 Gestione Environment Variables - File Unico

## 🎯 Problema Risolto

**Prima** avevamo due file duplicati:
- ❌ `.env` (per Prisma CLI)
- ❌ `.env.local` (per Next.js)

**Ora** usiamo un solo file:
- ✅ `.env.local` (per TUTTO)

---

## 🔧 Come Funziona

### Soluzione Implementata

Abbiamo installato `dotenv-cli` che permette a Prisma di leggere `.env.local`:

```bash
npm install -D dotenv-cli
```

Poi abbiamo aggiunto script npm che usano `dotenv-cli`:

```json
{
  "scripts": {
    "prisma:studio": "dotenv -e .env.local -- prisma studio",
    "prisma:push": "dotenv -e .env.local -- prisma db push",
    "prisma:migrate": "dotenv -e .env.local -- prisma migrate dev"
  }
}
```

---

## 📋 Comandi Disponibili

### Next.js (come prima)

```bash
# Development
npm run dev

# Build
npm run build

# Start production
npm start
```
✅ Next.js legge automaticamente `.env.local`

---

### Prisma (nuovi comandi)

#### 1. Sincronizza Schema con Database
```bash
npm run prisma:push
```
Equivalente a `prisma db push` ma legge `.env.local`

#### 2. Apri Prisma Studio
```bash
npm run prisma:studio
```
Equivalente a `prisma studio` ma legge `.env.local`

#### 3. Crea Migration
```bash
npm run prisma:migrate
```
Equivalente a `prisma migrate dev` ma legge `.env.local`

---

## 🚫 Comandi da NON Usare

❌ **NON usare direttamente**:
```bash
npx prisma db push      # ❌ Non trova DATABASE_URL
npx prisma studio       # ❌ Non trova DATABASE_URL
npx prisma migrate dev  # ❌ Non trova DATABASE_URL
```

✅ **USA invece**:
```bash
npm run prisma:push     # ✅ Legge .env.local
npm run prisma:studio   # ✅ Legge .env.local
npm run prisma:migrate  # ✅ Legge .env.local
```

---

## 📁 File Unico: `.env.local`

```bash
# NextAuth.js
NEXTAUTH_SECRET=xxx
NEXTAUTH_URL=http://localhost:3000

# Database (NeonDB) - USATO DA TUTTO
DATABASE_URL="postgresql://..."

# OnlySocial API
ONLYSOCIAL_API_KEY=xxx
ONLYSOCIAL_WORKSPACE_UUID=xxx

# DigitalOcean Spaces
DO_SPACES_ENDPOINT=xxx
DO_SPACES_BUCKET=xxx
...

# Cron Job Security
CRON_SECRET=xxx
```

✅ **Un solo file da gestire**  
✅ **Già protetto dal `.gitignore`**  
✅ **Funziona con Next.js E Prisma**

---

## 🔄 Workflow Tipico

### 1. Sviluppo Locale
```bash
# Modifica .env.local se necessario
nano .env.local

# Avvia Next.js
npm run dev

# Se hai modificato lo schema Prisma
npm run prisma:push
```

### 2. Deploy su Vercel
```bash
# Vercel usa le Environment Variables dalla dashboard
# NON legge .env.local (che è gitignored)
```

**Variabili da configurare su Vercel**:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `ONLYSOCIAL_API_KEY`
- `ONLYSOCIAL_WORKSPACE_UUID`
- `DO_SPACES_*`
- `CRON_SECRET`

---

## 🧪 Test

### Verifica che tutto funzioni:

```bash
# 1. Test Prisma
npm run prisma:push
# Output atteso: "The database is already in sync"

# 2. Test Build
npm run build
# Output atteso: "Compiled successfully"

# 3. Test Dev
npm run dev
# Output atteso: Server started on http://localhost:3000
```

---

## 📊 Vantaggi

| Aspetto | Prima | Ora |
|---------|-------|-----|
| **File da gestire** | 2 (`.env` + `.env.local`) | 1 (`.env.local`) |
| **Sincronizzazione** | Manuale (copia/incolla) | Automatica |
| **Rischio errori** | Alto (dimenticare di sincronizzare) | Basso |
| **Manutenzione** | Difficile | Facile |

---

## 🎓 Spiegazione Tecnica

### Perché `.env.local`?

Next.js carica i file `.env*` in questo ordine di priorità:

1. `.env.local` (usato per override locali)
2. `.env.development` / `.env.production` (per ambiente)
3. `.env` (base)

`.env.local` è il file **consigliato** per valori locali perché:
- ✅ Ha la priorità più alta
- ✅ Non viene committato (gitignore)
- ✅ È specifico per la macchina locale

### Come funziona `dotenv-cli`

```bash
dotenv -e .env.local -- prisma db push
```

1. `dotenv` carica le variabili da `.env.local`
2. `-e .env.local` specifica il file da usare
3. `--` separa gli argomenti di dotenv da quelli del comando
4. `prisma db push` viene eseguito con le variabili caricate

---

## 📝 Checklist Migrazione

- [x] Installato `dotenv-cli`
- [x] Aggiornato `package.json` con nuovi script
- [x] Eliminato `.env` duplicato
- [x] Testato `npm run prisma:push`
- [x] Testato `npm run build`
- [x] Documentazione creata

---

## 🚨 Note Importanti

### `.gitignore`
```
.env*
```
✅ `.env.local` è già protetto e non verrà committato

### Vercel
⚠️ **Vercel NON legge `.env.local`**

Devi configurare le variabili manualmente nella dashboard:
```
Vercel Dashboard → Settings → Environment Variables
```

### CI/CD
Se usi GitHub Actions o altri CI/CD, devi configurare i secrets lì.

---

## 💡 Suggerimento

Se vuoi vedere quali variabili sono caricate:

```bash
# In uno script o nel terminale
dotenv -e .env.local -- printenv | grep -E "(DATABASE_URL|NEXTAUTH_SECRET|ONLYSOCIAL)"
```

O in Next.js:
```typescript
console.log('Database URL:', process.env.DATABASE_URL?.substring(0, 50) + '...')
```

---

## 🎉 Conclusione

✅ **File unico**: `.env.local`  
✅ **Script semplificati**: `npm run prisma:*`  
✅ **Meno errori**: Un solo file da mantenere  
✅ **Best practice**: Segue le convenzioni Next.js

**Data Implementazione**: 30 Novembre 2025  
**Versione**: 1.0
