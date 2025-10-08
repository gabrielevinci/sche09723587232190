# 🎯 Configurazione CORS per DigitalOcean Spaces - Guida Visuale

## ✅ RISOLTO: Errore Deploy

L'errore di deploy con `react-data-grid` è stato risolto aggiungendo `overrides` nel `package.json`. Il deploy ora funzionerà correttamente.

---

## 📋 Configurazione CORS Passo-Passo

### Dove Trovare le Impostazioni CORS

1. Accedi a https://cloud.digitalocean.com/spaces
2. Clicca sul tuo Space: `scheduler-0chiacchiere`
3. Vai su **Settings** (nella sidebar sinistra)
4. Scorri fino a **CORS Configurations**
5. Clicca su **Advanced CORS Options**

---

## 🔧 Come Compilare il Form CORS

### Regola #1: Accesso da Vercel (OBBLIGATORIA)

Nel form "Advanced CORS Options" compila:

```
┌─────────────────────────────────────────────────┐
│ Origin*                                         │
│ https://sche09723587232190.vercel.app          │ ← IL TUO DOMINIO VERCEL
└─────────────────────────────────────────────────┘

Allowed Methods*
☑️ GET          ← SELEZIONA (per visualizzare video)
☑️ HEAD         ← SELEZIONA (per metadata)
☑️ PUT          ← SELEZIONA (per upload diretto)
☐  POST         ← NON SELEZIONARE
☐  DELETE       ← NON SELEZIONARE

┌─────────────────────────────────────────────────┐
│ Allowed Headers                                 │
│ *                                               │ ← METTI ASTERISCO
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Access Control Max Age                          │
│ 3000                                            │ ← OPZIONALE
└─────────────────────────────────────────────────┘
```

### Regola #2: Accesso Localhost (OPZIONALE - per sviluppo)

Clicca **+ Add Header** per aggiungere una seconda regola:

```
┌─────────────────────────────────────────────────┐
│ Origin*                                         │
│ http://localhost:3000                          │ ← PER DEV LOCALE
└─────────────────────────────────────────────────┘

Allowed Methods*
☑️ GET
☑️ HEAD
☐  PUT
☐  POST
☐  DELETE

┌─────────────────────────────────────────────────┐
│ Allowed Headers                                 │
│ *                                               │
└─────────────────────────────────────────────────┘
```

Clicca **Save CORS Configuration** in basso.

---

## ⚠️ IMPORTANTE

### ✅ DA FARE:
- ✅ Usa `https://` per il dominio Vercel (NON `http://`)
- ✅ Includi il dominio completo (con sottodominio)
- ✅ Seleziona solo GET e HEAD (sufficienti per visualizzare video)
- ✅ Se hai un dominio custom, usa quello al posto del dominio Vercel

### ❌ DA NON FARE:
- ❌ NON usare `*` come Origin in produzione (meno sicuro)
- ❌ NON selezionare PUT/POST/DELETE (non servono per visualizzare video)
- ❌ NON dimenticare `https://` nell'origin
- ❌ NON usare solo il dominio senza protocollo

---

## 🧪 Test Configurazione CORS

Dopo aver salvato, verifica che funzioni:

### Metodo 1: Test da Browser
```javascript
// Apri Console del browser su https://sche09723587232190.vercel.app
fetch('https://scheduler-0chiacchiere.lon1.digitaloceanspaces.com/test-file.mp4')
  .then(res => console.log('CORS OK!', res.status))
  .catch(err => console.error('CORS Error:', err))
```

### Metodo 2: Test dall'App
1. Accedi a https://sche09723587232190.vercel.app/dashboard
2. Clicca "Carica + Schedula"
3. Seleziona un profilo
4. Carica un video di test
5. Se vedi la preview del video nel drawer → **CORS OK! ✅**

---

## 🔍 Troubleshooting CORS

### Errore: "No 'Access-Control-Allow-Origin' header"

**Causa**: Origin non configurato correttamente

**Soluzione**:
```
Verifica che l'Origin sia esattamente:
https://sche09723587232190.vercel.app

NON:
- http://sche09723587232190.vercel.app  ❌ (http invece di https)
- sche09723587232190.vercel.app         ❌ (manca https://)
- https://vercel.app                     ❌ (dominio sbagliato)
```

### Errore: "Method GET not allowed by CORS"

**Causa**: Metodi non selezionati

**Soluzione**:
- Assicurati di aver selezionato ✅ GET
- Assicurati di aver selezionato ✅ HEAD

### Video non si caricano

**Causa**: CORS non propagato o cache browser

**Soluzione**:
1. Aspetta 1-2 minuti (propagazione CORS)
2. Svuota cache browser (Ctrl+Shift+Del)
3. Riprova in finestra incognito
4. Controlla Network tab in DevTools per vedere errori CORS

---

## 📊 Esempio Configurazione XML (Alternativa)

Se preferisci configurare via API invece che UI:

```xml
<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <CORSRule>
    <AllowedOrigin>https://sche09723587232190.vercel.app</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <MaxAgeSeconds>3000</MaxAgeSeconds>
  </CORSRule>
  <CORSRule>
    <AllowedOrigin>http://localhost:3000</AllowedOrigin>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <MaxAgeSeconds>3000</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

---

## 🎓 Perché Questa Configurazione?

### GET e HEAD
- **GET**: Necessario per scaricare e visualizzare i video
- **HEAD**: Usato dai browser per verificare esistenza file
- **PUT/POST/DELETE**: NON necessari (i video vengono caricati dal server, non dal browser)

### Origin Specifico
- Usa il dominio Vercel esatto per sicurezza
- Evita `*` in produzione (permette accesso da qualsiasi sito)

### MaxAgeSeconds
- Cache delle preflight requests (riduce richieste OPTIONS)
- 3000 secondi = 50 minuti

---

## 🚀 Prossimi Passi

Dopo aver configurato CORS:

1. ✅ Salva la configurazione CORS
2. ✅ Aspetta 1-2 minuti per propagazione
3. ✅ Vai su Vercel e aggiungi le variabili d'ambiente
4. ✅ Fai un redeploy (già fatto automaticamente con l'ultimo push!)
5. ✅ Testa l'upload di un video dalla dashboard

---

## 📞 Supporto

Se CORS ancora non funziona:
1. Screenshot della configurazione CORS
2. Screenshot dell'errore in Console browser (F12 → Console)
3. Screenshot del Network tab (F12 → Network → filtro per il file video)
4. Invia a supporto o ricontrolla questa guida
