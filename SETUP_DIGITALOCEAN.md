# 🚀 Setup DigitalOcean Spaces per il Progetto

## Passaggi da Completare su Vercel

### 1. Crea uno Space su DigitalOcean (se non l'hai già fatto)

1. Vai su https://cloud.digitalocean.com/spaces
2. Clicca su **"Create Space"**
3. Configura:
   - **Name**: `scheduler-0chiacchiere` (o un altro nome, ma aggiorna anche DO_SPACES_BUCKET)
   - **Region**: `London (LON1)` (o altra regione, ma aggiorna anche DO_SPACES_ENDPOINT e DO_SPACES_REGION)
   - **Enable CDN**: Opzionale
   - **File Listing**: Public o Restricted (consigliato Restricted)

### 2. Crea Access Keys

1. Vai su https://cloud.digitalocean.com/account/api/spaces
2. Clicca su **"Generate New Key"**
3. Dai un nome (es: "scheduler-app-key")
4. **IMPORTANTE**: Copia subito la Secret Key (non sarà più visibile!)
   - Access Key ID: sarà qualcosa come `DO00ABCD1234EFGH5678`
   - Secret Access Key: sarà una lunga stringa casuale

### 3. Configura CORS (OBBLIGATORIO)

I video devono essere accessibili da browser, quindi CORS è necessario:

1. Vai al tuo Space su DigitalOcean
2. **Settings** → **CORS Configurations** → **Advanced CORS Options**
3. Compila i campi come segue:

#### Prima Regola CORS (per visualizzare i video):
- **Origin**: `https://sche09723587232190.vercel.app`
  (oppure `https://tuodominio.com` se hai un dominio custom)
- **Allowed Methods**: ✅ Seleziona solo **GET** e **HEAD**
- **Allowed Headers**: Lascia vuoto o aggiungi `*`
- **Access Control Max Age**: `3000` (opzionale, in secondi)

#### Seconda Regola CORS (opzionale, per localhost durante sviluppo):
Clicca **+ Add Header** per aggiungere un'altra regola:
- **Origin**: `http://localhost:3000`
- **Allowed Methods**: ✅ Seleziona **GET** e **HEAD**
- **Allowed Headers**: `*`

**Importante**: 
- ✅ **NON** selezionare PUT, POST, DELETE (non necessari per visualizzare video)
- ✅ Origin deve includere `https://` (non solo il dominio)
- ✅ Se usi Vercel, usa il dominio completo di Vercel o il tuo dominio custom

Clicca **Save CORS Configuration** per salvare.

### 4. Aggiungi le Variabili d'Ambiente su Vercel

1. Vai su https://vercel.com/gabrielevinci/sche09723587232190/settings/environment-variables
2. Aggiungi queste variabili:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `DO_SPACES_ENDPOINT` | `https://lon1.digitaloceanspaces.com` | Production, Preview, Development |
| `DO_SPACES_REGION` | `lon1` | Production, Preview, Development |
| `DO_SPACES_BUCKET` | `scheduler-0chiacchiere` | Production, Preview, Development |
| `DO_SPACES_KEY` | `[La tua Access Key ID]` | Production, Preview, Development |
| `DO_SPACES_SECRET` | `[La tua Secret Access Key]` | Production, Preview, Development |

**Note:**
- Se hai scelto una regione diversa da London, adatta `DO_SPACES_ENDPOINT` e `DO_SPACES_REGION`
- Esempi endpoint per altre regioni:
  - NYC3: `https://nyc3.digitaloceanspaces.com`
  - AMS3: `https://ams3.digitaloceanspaces.com`
  - SGP1: `https://sgp1.digitaloceanspaces.com`
  - SFO3: `https://sfo3.digitaloceanspaces.com`

### 5. Redeploy l'Applicazione

Dopo aver aggiunto le variabili:
1. Vai su https://vercel.com/gabrielevinci/sche09723587232190
2. Clicca su **"Redeploy"** nell'ultimo deployment
3. Oppure fai un nuovo push su GitHub (il deploy sarà automatico)

## ✅ Verifica Configurazione

Una volta completato il setup:

1. Accedi all'app: https://sche09723587232190.vercel.app/dashboard
2. Clicca su **"Carica + Schedula"**
3. Seleziona un profilo
4. Carica un video di test
5. Se vedi il drawer con il video caricato → **Setup OK! ✅**

Se vedi errori:
- Controlla i log Vercel: https://vercel.com/gabrielevinci/sche09723587232190/logs
- Verifica che tutte le variabili siano settate
- Verifica che le credenziali DigitalOcean siano corrette

## 📊 Monitoraggio Usage

Monitora l'utilizzo dello Space:
1. Vai su https://cloud.digitalocean.com/spaces/scheduler-0chiacchiere
2. Controlla:
   - Storage utilizzato
   - Bandwidth utilizzato
   - Numero di file
   - Costi mensili

## 🔒 Sicurezza

Le chiavi di accesso sono sensibili:
- ✅ **SI**: Salvale in variabili d'ambiente Vercel
- ✅ **SI**: Usa Secret Access Key in modo sicuro
- ❌ **NO**: Non commitarle mai su Git
- ❌ **NO**: Non condividerle pubblicamente

## 💡 Tips

1. **Organizzazione File**: I video sono già organizzati in: `/userId/profileId/timestamp/`
2. **Pulizia**: Considera di implementare una pulizia automatica dei video vecchi
3. **CDN**: Se attivi CDN su DO Spaces, i video saranno serviti più velocemente
4. **Backup**: DigitalOcean Spaces ha già ridondanza built-in
5. **Costs**: Monitora i costi, specialmente se carichi molti video grandi

## 📝 Costi Stimati DigitalOcean Spaces

- **Storage**: $5/mese per 250 GB
- **Transfer**: $10/mese per 1 TB
- **Requests**: Inclusi nel prezzo

Per 1000 video da 50MB ciascuno:
- Storage: ~50GB → circa $1-2/mese
- Transfer: dipende da visualizzazioni

## 🆘 Support

In caso di problemi:
1. Controlla i log Vercel
2. Verifica configurazione DO Spaces
3. Testa l'upload direttamente dal pannello DigitalOcean
4. Contatta supporto DigitalOcean se necessario
