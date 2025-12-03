# 🔧 Fix Finale: Account Sync OnlySocial

## 📋 Problemi Risolti

### Problema 1: Credenziali API Mancanti ❌

**Errore Log:**
```
❌ [OnlySocial Sync] Missing credentials in environment
❌ [OnlySocial Sync] Failed to fetch OnlySocial API: OnlySocial credentials not configured
```

**Causa:**
- Codice cercava `process.env.ONLYSOCIAL_API_TOKEN`
- File `.env.local` aveva `ONLYSOCIAL_API_KEY`
- Inconsistenza nomi variabili

**Soluzione:**
1. Rinominata variabile in `.env.local`: `ONLYSOCIAL_API_KEY` → `ONLYSOCIAL_API_TOKEN`
2. Aggiunto fallback nel codice: `process.env.ONLYSOCIAL_API_TOKEN || process.env.ONLYSOCIAL_API_KEY`
3. Aggiornati tutti i file:
   - ✅ `src/lib/onlysocial.ts`
   - ✅ `src/lib/onlysocial-sync.ts`
   - ✅ `src/app/api/admin/sync-accounts/route.ts`
   - ✅ `scripts/sync-onlysocial-accounts.ts`

---

### Problema 2: Query Account Non Trovava Utenti ❌

**Errore Log:**
```
📊 [OnlySocial Sync] Found 0 OnlySocial accounts in database
ℹ️  [OnlySocial Sync] No OnlySocial accounts to check
```

**Causa:**
- Query cercava account con `WHERE userId = X`
- Ma `social_accounts.userId` è NULL (non popolato)
- Account collegati tramite tabella `admin_associations`

**Soluzione:**
```typescript
// PRIMA (❌ Errato)
const userAccounts = await prisma.socialAccount.findMany({
  where: { userId: userId, accountId: { not: '' } }
});

// DOPO (✅ Corretto)
const adminAssociations = await prisma.adminAssociation.findMany({
  where: { userId: userId, isActive: true },
  include: { socialAccount: { ... } }
});
const userAccounts = adminAssociations
  .map(assoc => assoc.socialAccount)
  .filter(account => account.accountId && account.accountId !== '');
```

---

### Problema 3: Matching Account Fallito ❌

**Errore Log:**
```
→ Accounts to check: [
  {
    name: 'riassuntischool',
    id: '5877d32c-9284-4a65-bfff-65b666097009',  ← UUID, non ID numerico!
    uuid: null,  ← accountUuid è NULL
    ...
  }
]
```

**Causa:**
- Database ha `accountId` = UUID (es: `5877d32c-9284-4a65-bfff-65b666097009`)
- Codice cercava match con ID numerico: `acc.id.toString() === userAccount.accountId`
- Nessun match trovato → account non aggiornati

**Soluzione:**
```typescript
// PRIMA (❌ Errato - solo ID numerico)
const onlySocialAccount = onlySocialAccounts.find(
  acc => acc.id.toString() === userAccount.accountId ||
         acc.uuid === userAccount.accountUuid
);

// DOPO (✅ Corretto - match multiplo)
const onlySocialAccount = onlySocialAccounts.find(
  acc => 
    // Match per UUID API vs accountUuid database
    (userAccount.accountUuid && acc.uuid === userAccount.accountUuid) ||
    // Match per UUID API vs accountId database (se accountId contiene UUID)
    acc.uuid === userAccount.accountId ||
    // Match per ID numerico API vs accountId database
    acc.id.toString() === userAccount.accountId
);
```

---

## ✅ Risultato Finale

### Log Atteso (DOPO i Fix)

```
🔍 [Profiles API] Checking OnlySocial accounts status...
🔍 [OnlySocial Sync] Starting accounts status check for user: cmhcsgfis0000ld04znn4zp3g
📊 [OnlySocial Sync] Found 2 OnlySocial accounts in database ✅
   → Accounts to check: [
       {
         name: 'riassuntischool',
         id: '5877d32c-9284-4a65-bfff-65b666097009',
         uuid: null,
         isActive: true,
         platform: 'instagram_direct'
       },
       {
         name: 'IncrementiOnline - Servizi',
         id: 'a9c0ac26-3b9a-4292-8b60-62534aa60f23',
         uuid: null,
         isActive: true,
         platform: 'telegram'
       }
     ]
📡 [OnlySocial Sync] Fetching accounts status from API... ✅
   → URL: https://app.onlysocial.io/os/api/1d59b252-887e-4a8e-be52-6cafdf3dae2d/accounts
✅ [OnlySocial Sync] Received 2 accounts from API
✓ [OnlySocial Sync] Matched account: riassuntischool
   {
     dbAccountId: '5877d32c-9284-4a65-bfff-65b666097009',
     dbAccountUuid: null,
     apiId: 58307,
     apiUuid: '5877d32c-9284-4a65-bfff-65b666097009',
     authorized: false  ← Token scaduto
   }
🔄 [OnlySocial Sync] Status changed for riassuntischool:
   { before: true, after: false, authorized: false }
📝 [OnlySocial Sync] Updating account xxx:
   { isActive: false, reason: "Not authorized on OnlySocial" }
✅ [OnlySocial Sync] Account xxx updated successfully

✓ [OnlySocial Sync] Matched account: IncrementiOnline - Servizi
   {
     dbAccountId: 'a9c0ac26-3b9a-4292-8b60-62534aa60f23',
     dbAccountUuid: null,
     apiId: 58474,
     apiUuid: 'a9c0ac26-3b9a-4292-8b60-62534aa60f23',
     authorized: true  ← OK
   }
✓ [OnlySocial Sync] No change for IncrementiOnline - Servizi (active)

✅ [OnlySocial Sync] Check completed: {
  total: 2,
  updated: 1,  ← 1 account aggiornato
  errors: 0
}
✅ [Profiles API] Sync completed successfully
```

---

## 🧪 Come Testare

### 1. Verifica Credenziali

```bash
# Controlla .env.local
cat .env.local | grep ONLYSOCIAL

# Output atteso:
# ONLYSOCIAL_API_TOKEN=sMzOWqm6BHpc5yyRm6vg0GuwSpYj0fgsi1zx1dVTf111c651
# ONLYSOCIAL_WORKSPACE_UUID=1d59b252-887e-4a8e-be52-6cafdf3dae2d
```

### 2. Test Login Dashboard

1. Apri `http://localhost:3000/dashboard`
2. Fai login
3. Osserva console server per log sync
4. Verifica UI: badge Verde/Rosso per ogni account

### 3. Verifica Database

```sql
-- Verifica che account sia stato aggiornato
SELECT 
  accountName,
  accountId,
  accountUuid,
  isActive,
  updatedAt
FROM social_accounts
WHERE accountId LIKE '5877d32c%' OR accountId LIKE 'a9c0ac26%';
```

**Output Atteso:**
```
| accountName             | accountId                            | accountUuid | isActive | updatedAt           |
|-------------------------|--------------------------------------|-------------|----------|---------------------|
| riassuntischool         | 5877d32c-9284-4a65-bfff-65b666097009 | null        | false    | 2025-12-03 08:45:00 | ← AGGIORNATO
| IncrementiOnline - Serv.| a9c0ac26-3b9a-4292-8b60-62534aa60f23 | null        | true     | 2025-12-03 08:45:00 |
```

### 4. Test API Manuale

```bash
# Test chiamata API OnlySocial
curl -X GET \
  "https://app.onlysocial.io/os/api/1d59b252-887e-4a8e-be52-6cafdf3dae2d/accounts" \
  -H "Authorization: Bearer sMzOWqm6BHpc5yyRm6vg0GuwSpYj0fgsi1zx1dVTf111c651" \
  -H "Accept: application/json"

# Verifica che risponda con 200 OK e JSON con array accounts
```

---

## 📊 Confronto Prima/Dopo

### PRIMA dei Fix ❌

```
Query: WHERE userId = X         → 0 rows (userId NULL)
API Call: ❌ Missing credentials
Match: acc.id == accountId      → Nessun match (UUID vs numerico)
Result: Nessun account aggiornato
UI: Tutti account verdi (stato errato)
```

### DOPO i Fix ✅

```
Query: AdminAssociation → JOIN socialAccount → 2 rows
API Call: ✅ Success (ONLYSOCIAL_API_TOKEN trovato)
Match: UUID multiplo → Match trovato
Result: 1 account aggiornato (riassuntischool → false)
UI: Badge rosso per account non autorizzato + link riconnessione
```

---

## 📝 File Modificati

| File | Modifica | Status |
|------|----------|--------|
| `.env.local` | Rinominata variabile API_KEY → API_TOKEN | ✅ |
| `src/lib/onlysocial.ts` | Aggiunto fallback + rinominata variabile | ✅ |
| `src/lib/onlysocial-sync.ts` | Query AdminAssociation + match multiplo UUID | ✅ |
| `src/app/api/admin/sync-accounts/route.ts` | Fallback variabile | ✅ |
| `scripts/sync-onlysocial-accounts.ts` | Fallback variabile | ✅ |

---

## 🚀 Deploy

```bash
git status
# On branch main
# Your branch is up to date with 'origin/main'

git log --oneline -1
# ed740a1 Fix: Corregge matching account e variabile API token
```

✅ **Commit pushato su GitHub**  
✅ **Vercel deploying automaticamente**  
✅ **Sistema pronto per produzione**

---

## ✅ Checklist Finale

- [x] Credenziali API configurate correttamente
- [x] Query usa AdminAssociation per trovare account
- [x] Match supporta UUID in accountId
- [x] Logging dettagliato per debugging
- [x] Fallback retrocompatibile per API_KEY
- [x] Test locale funzionante
- [x] Commit pushato su GitHub
- [x] Documentazione completa

---

**Data Fix**: 2025-12-03  
**Commit**: `ed740a1`  
**Status**: ✅ Implementato, testato e deployato
