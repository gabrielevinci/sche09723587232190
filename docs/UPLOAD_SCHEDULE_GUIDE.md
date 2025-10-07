# Guida: Funzionalità Carica + Schedula

## Configurazione

### 1. Variabili d'Ambiente Richieste

Aggiungi queste variabili nel tuo ambiente Vercel o file `.env.local`:

```bash
# DigitalOcean Spaces
DO_SPACES_ENDPOINT="https://lon1.digitaloceanspaces.com"
DO_SPACES_REGION="lon1"
DO_SPACES_BUCKET="scheduler-0chiacchiere"
DO_SPACES_KEY="tua_access_key"
DO_SPACES_SECRET="tua_secret_key"

# OnlySocial (già configurate)
ONLYSOCIAL_API_KEY="tuo_api_key"
ONLYSOCIAL_WORKSPACE_UUID="tuo_workspace_uuid"
```

### 2. Permessi DigitalOcean Spaces

Assicurati che il tuo Space sia configurato con:
- **ACL pubblici abilitati** per i file caricati
- **CORS configurato** se necessario per accesso da browser

## Come Utilizzare

### Workflow Completo

1. **Login** come utente con profili social assegnati dall'admin

2. **Dashboard**: Clicca sul pulsante **"Carica + Schedula"**

3. **Selezione Profilo**: 
   - Si apre un modal con i tuoi profili social
   - Seleziona il profilo su cui vuoi pubblicare

4. **Selezione Video**:
   - Si apre l'esplora file
   - Seleziona **multipli file video** (Ctrl+click o Shift+click)
   - I video vengono caricati automaticamente su DigitalOcean Spaces

5. **Drawer Excel**:
   - Si apre un drawer laterale con una tabella tipo Excel
   - Ogni riga rappresenta un video (ordinato alfabeticamente per nome)
   - Compila le colonne:

#### Colonne della Tabella

| Colonna | Descrizione | Valori |
|---------|-------------|--------|
| **Video** | Nome file (non editabile) | Auto |
| **Didascalia** | Caption del post | Testo libero |
| **Anno** | Anno pubblicazione | 2000-2100 |
| **Mese** | Mese pubblicazione | 1-12 |
| **Giorno** | Giorno pubblicazione | 1-31* |
| **Orario hh** | Ora pubblicazione | 0-23 |
| **Minuti** | Minuti pubblicazione | 0-59 |
| **Tipologia post** | Tipo contenuto | reel, story, post |
| **Preview** | Anteprima video (primo frame) | Auto |

*Il sistema valida automaticamente le date (es: 31/02 non è valido)

### Funzionalità Excel

- **Click**: Seleziona una cella
- **Doppio Click**: Modifica cella
- **Ctrl+C / Ctrl+V**: Copia/incolla tra celle
- **Tab**: Passa alla cella successiva
- **Enter**: Passa alla riga successiva
- **Shift+Click**: Seleziona intervallo di celle

### Validazione

Il sistema valida automaticamente:
- ✅ Date valide (giorni effettivi per ogni mese)
- ✅ Ore valide (0-23)
- ✅ Minuti validi (0-59)
- ✅ Campi obbligatori (Caption, Post Type)
- ❌ Date invalide mostrate in **rosso** con tooltip

### Scheduling

6. Una volta compilata la tabella, clicca **"Schedula Tutti"**
7. Il sistema:
   - Valida tutti i dati
   - Crea i post su OnlySocial
   - Schedula alle date/ore specificate
   - Mostra un riepilogo con eventuali errori

## Struttura File su DigitalOcean Spaces

I video vengono organizzati in:

```
scheduler-0chiacchiere/
└── {userId}/
    └── {profileId}/
        └── {timestamp}/
            ├── video1.mp4
            ├── video2.mp4
            └── video3.mp4
```

Esempio:
```
/cm69gn5hf000008mc9uq40hxw/
  /cm6ecpxdu0000i6evxu4w33ec/
    /2025-10-08T23-45-12-345Z/
      /mio_video.mp4
```

## API Endpoints

### POST /api/upload/videos
Carica video su DigitalOcean Spaces

**Body (multipart/form-data):**
```
profileId: string
videos: File[]
```

**Response:**
```json
{
  "success": true,
  "uploaded": 3,
  "total": 3,
  "videos": [
    {
      "fileName": "video1.mp4",
      "url": "https://scheduler-0chiacchiere.lon1.digitaloceanspaces.com/...",
      "size": 12345678
    }
  ],
  "uploadPath": "userId/profileId/timestamp"
}
```

### POST /api/schedule/posts
Schedula post su OnlySocial

**Body (JSON):**
```json
{
  "profileId": "cm6ecpxdu0000i6evxu4w33ec",
  "accountUuid": "abc123-uuid",
  "posts": [
    {
      "videoUrl": "https://...",
      "caption": "Il mio video!",
      "year": 2025,
      "month": 10,
      "day": 15,
      "hour": 18,
      "minute": 30,
      "postType": "reel"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "total": 3,
  "scheduled": 3,
  "errors": 0,
  "posts": [
    {
      "videoUrl": "https://...",
      "postUuid": "post-uuid-123",
      "scheduledAt": "2025-10-15 18:30:00",
      "status": "success"
    }
  ],
  "message": "Tutti i 3 post sono stati schedulati con successo!"
}
```

## Troubleshooting

### Errore: "DigitalOcean Spaces non configurato"
- Verifica che tutte le variabili DO_SPACES_* siano settate
- Controlla che le credenziali siano corrette

### Errore: "Profilo non autorizzato"
- Verifica che l'admin ti abbia assegnato il profilo social
- Verifica nella dashboard che il profilo appaia nella sezione "Account Collegati"

### Video non caricati
- Controlla dimensione file (limite server/Vercel)
- Verifica formato file (deve essere video/*)
- Controlla permessi Space su DigitalOcean

### Data non valida
- Il sistema valida automaticamente:
  - Febbraio: max 28 giorni (29 per anni bisestili)
  - Mesi con 30 giorni: aprile, giugno, settembre, novembre
  - Mesi con 31 giorni: gennaio, marzo, maggio, luglio, agosto, ottobre, dicembre

### Errori OnlySocial
- Verifica che l'account UUID sia corretto
- Controlla i log Vercel per dettagli
- Verifica che il profilo sia attivo su OnlySocial

## Limiti Tecnici

- **Max upload size**: Dipende da configurazione Vercel/server
- **Timeout**: 5 minuti (maxDuration in route handlers)
- **Formati video**: Qualsiasi formato accettato da OnlySocial
- **Numero file**: Nessun limite hard-coded, ma consigliati batch < 50 video

## Prossimi Sviluppi

- [ ] Drag & drop per riordinare video
- [ ] Template per didascalie ricorrenti
- [ ] Copia schedulazione tra profili
- [ ] Import/Export da CSV/Excel
- [ ] Anteprime video più grandi
- [ ] Modifica post già schedulati
