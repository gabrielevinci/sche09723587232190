# 🧪 Test Fix: Query Sync Account OnlySocial

## 🐛 Problema Riscontrato

**Log Errore:**
```
📊 [OnlySocial Sync] Found 0 OnlySocial accounts in database
ℹ️  [OnlySocial Sync] No OnlySocial accounts to check
```

**Causa:**
La query SQL utilizzava:
```sql
SELECT * FROM social_accounts 
WHERE userId = ? AND accountId <> ''
```

Ma la tabella `social_accounts` **non ha** il campo `userId` direttamente popolato.
Gli account sono collegati agli utenti tramite la tabella `admin_associations`.

## ✅ Soluzione Implementata

### Prima (❌ Non Funzionante)

```typescript
const userAccounts = await prisma.socialAccount.findMany({
  where: {
    userId: userId,  // ❌ Questo campo è sempre NULL o non corrisponde
    accountId: { not: '' }
  }
});
```

### Dopo (✅ Funzionante)

```typescript
// 1. Recupera le associazioni admin dell'utente
const adminAssociations = await prisma.adminAssociation.findMany({
  where: {
    userId: userId,
    isActive: true,  // Solo associazioni attive
  },
  include: {
    socialAccount: {
      select: {
        id: true,
        accountId: true,
        accountUuid: true,
        accountName: true,
        platform: true,
        isActive: true,
        updatedAt: true,
      }
    }
  }
});

// 2. Estrai gli account OnlySocial (con accountId)
const userAccounts = adminAssociations
  .map(assoc => assoc.socialAccount)
  .filter(account => account.accountId && account.accountId !== '');
```

## 📊 Query SQL Generate

### Prima (Errata)
```sql
SELECT * 
FROM social_accounts 
WHERE userId = 'cmhcsgfis0000ld04znn4zp3g' 
  AND accountId <> ''
-- Risultato: 0 rows (perché userId è NULL in social_accounts)
```

### Dopo (Corretta)
```sql
-- Step 1: Recupera associazioni
SELECT * 
FROM admin_associations 
WHERE userId = 'cmhcsgfis0000ld04znn4zp3g' 
  AND isActive = true;

-- Step 2: JOIN con social_accounts
SELECT sa.* 
FROM admin_associations aa
JOIN social_accounts sa ON aa.socialAccountId = sa.id
WHERE aa.userId = 'cmhcsgfis0000ld04znn4zp3g'
  AND aa.isActive = true
  AND sa.accountId IS NOT NULL
  AND sa.accountId <> '';
-- Risultato: 2 rows (riassuntischool, incrementionline)
```

## 🧪 Come Testare

### 1. Verifica Database

Controlla che gli account siano collegati tramite `admin_associations`:

```sql
-- Verifica associazioni utente
SELECT 
  u.email,
  aa.userId,
  aa.socialAccountId,
  aa.isActive AS association_active,
  sa.accountName,
  sa.accountId,
  sa.isActive AS account_active
FROM users u
JOIN admin_associations aa ON u.id = aa.userId
JOIN social_accounts sa ON aa.socialAccountId = sa.id
WHERE u.email = 'your-email@example.com';
```

**Output Atteso:**
```
| email           | userId | socialAccountId | association_active | accountName      | accountId | account_active |
|-----------------|--------|-----------------|--------------------|--------------------|-----------|----------------|
| user@email.com  | cmh... | cmh...          | true               | riassuntischool    | 58307     | true (da aggiornare)|
| user@email.com  | cmh... | cmh...          | true               | incrementionline   | 58474     | true           |
```

### 2. Test Login Dashboard

1. **Fai login su** `http://localhost:3000/login`
2. **Osserva console server** per vedere i log:

**Output Atteso (PRIMA del fix):**
```
🔍 [OnlySocial Sync] Starting accounts status check for user: cmhcsgfis0000ld04znn4zp3g
📊 [OnlySocial Sync] Found 0 OnlySocial accounts in database  ❌
ℹ️  [OnlySocial Sync] No OnlySocial accounts to check
```

**Output Atteso (DOPO il fix):**
```
🔍 [OnlySocial Sync] Starting accounts status check for user: cmhcsgfis0000ld04znn4zp3g
📊 [OnlySocial Sync] Found 2 OnlySocial accounts in database  ✅
   → Accounts to check: [
       {
         name: 'riassuntischool',
         id: '58307',
         uuid: '5877d32c-9284-4a65-bfff-65b666097009',
         isActive: true,
         platform: 'instagram_direct'
       },
       {
         name: 'incrementionline_service',
         id: '58474',
         uuid: 'a9c0ac26-3b9a-4292-8b60-62534aa60f23',
         isActive: true,
         platform: 'telegram'
       }
     ]
📡 [OnlySocial Sync] Fetching accounts status from API...
✅ [OnlySocial Sync] Received 2 accounts from API
🔄 [OnlySocial Sync] Status changed for riassuntischool:
   { before: true, after: false, authorized: false }  ← SE NON AUTORIZZATO
📝 [OnlySocial Sync] Updating account xxx: { isActive: false, ... }
✅ [OnlySocial Sync] Check completed: { total: 2, updated: 1, errors: 0 }
```

### 3. Verifica UI Dashboard

Dopo il login, nella sezione "Account Collegati":

**PRIMA del fix:**
- Mostra 2 account
- Entrambi con badge Verde "✅ Attivo"
- Nessun check API effettuato

**DOPO il fix:**
- Mostra 2 account
- Account autorizzato: badge Verde "✅ Attivo"
- Account NON autorizzato: badge Rosso "❌ Non Autorizzato" + link riconnessione

### 4. Test Sync Manuale

1. Clicca pulsante **"Aggiorna"** nella dashboard
2. Osserva log console server
3. Verifica alert: "✅ X account aggiornati"

**Output Atteso:**
```
🔄 [Dashboard] Force sync account status requested
🔄 [Profiles Sync API] Force sync requested for user: cmhcsgfis0000ld04znn4zp3g
📊 [OnlySocial Sync] Found 2 OnlySocial accounts in database  ✅
... (procede con check API) ...
✅ [Profiles Sync API] Sync completed: { total: 2, updated: 1, errors: 0 }
```

### 5. Verifica Database Post-Sync

```sql
-- Verifica che isActive sia stato aggiornato
SELECT 
  accountName,
  accountId,
  isActive,
  updatedAt
FROM social_accounts
WHERE accountId IN ('58307', '58474')
ORDER BY accountName;
```

**Output Atteso:**
```
| accountName             | accountId | isActive | updatedAt           |
|-------------------------|-----------|----------|---------------------|
| incrementionline_serv.  | 58474     | true     | 2025-12-03 08:30:00 |
| riassuntischool         | 58307     | false    | 2025-12-03 08:30:00 | ← AGGIORNATO
```

## 📋 Checklist Testing

- [ ] Server di sviluppo avviato (`npm run dev`)
- [ ] Login effettuato su `/dashboard`
- [ ] Log mostra "Found X OnlySocial accounts" (X > 0)
- [ ] Log mostra chiamata API OnlySocial
- [ ] Log mostra confronto authorized vs isActive
- [ ] Database aggiornato: account non autorizzato ha isActive=false
- [ ] UI mostra badge rosso per account non autorizzato
- [ ] Link "Riconnetti su OnlySocial" presente e funzionante
- [ ] Pulsante "Aggiorna" forza sync correttamente
- [ ] Cache 5 minuti funziona (nessuna API call se recente)

## 🔍 Debug Tips

### Se ancora mostra "Found 0 accounts":

1. **Verifica associazioni nel database:**
   ```sql
   SELECT * FROM admin_associations WHERE userId = 'your-user-id';
   ```
   Se vuoto → L'utente non ha account assegnati

2. **Verifica campo accountId:**
   ```sql
   SELECT accountId, accountName FROM social_accounts;
   ```
   Se accountId è NULL o '' → Account non sincronizzato da OnlySocial

3. **Verifica isActive association:**
   ```sql
   SELECT * FROM admin_associations 
   WHERE userId = 'your-user-id' AND isActive = false;
   ```
   Se false → Associazione disattivata, non verrà processata

### Se API OnlySocial fallisce:

1. Verifica `.env.local`:
   ```env
   ONLYSOCIAL_WORKSPACE_UUID=1d59b252-887e-4a8e-be52-6cafdf3dae2d
   ONLYSOCIAL_API_TOKEN=your_token_here
   ```

2. Test manuale API:
   ```bash
   curl -X GET \
     "https://app.onlysocial.io/os/api/1d59b252-887e-4a8e-be52-6cafdf3dae2d/accounts" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Accept: application/json"
   ```

## ✅ Risultato Atteso Finale

1. ✅ Query trova account tramite `AdminAssociation`
2. ✅ Chiamata API OnlySocial eseguita con successo
3. ✅ Account non autorizzati rilevati (`authorized: false`)
4. ✅ Database aggiornato (`isActive: false`)
5. ✅ UI mostra badge rosso con avviso
6. ✅ Link riconnessione disponibile
7. ✅ Sync manuale funzionante
8. ✅ Cache previene chiamate eccessive

---

**Data Test**: 2025-12-03  
**Fix Commit**: `790fe1a`  
**Status**: ✅ Implementato e pronto per test
