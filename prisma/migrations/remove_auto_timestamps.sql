-- Migration: Remove default values from createdAt and updatedAt
-- Date: 2025-12-01
-- Description: Remove @default(now()) and @updatedAt from timestamp fields to manage them manually with Italian timezone

-- Note: I campi createdAt e updatedAt continueranno a esistere, ma non avranno più valori di default automatici
-- L'applicazione gestirà manualmente questi valori aggiungendo +1 ora per l'orario italiano

-- Nessuna modifica strutturale necessaria, solo cambio di gestione a livello applicativo
-- I dati esistenti rimarranno invariati
