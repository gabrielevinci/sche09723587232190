/**
 * Rate Limiter per OnlySocial API
 * Limite: max 25 richieste/minuto
 */

import Bottleneck from 'bottleneck';

// Rate limiter configurato per 25 req/min
// 60000ms / 25 = 2400ms tra richieste
export const onlySocialLimiter = new Bottleneck({
  minTime: 2400,        // Minimo 2.4 secondi tra richieste
  maxConcurrent: 1,     // Una richiesta alla volta
  reservoir: 25,        // Max 25 token
  reservoirRefreshAmount: 25,
  reservoirRefreshInterval: 60 * 1000, // Ricarica ogni 60 secondi
});

// Log semplice per errori (no TypeScript issues)
onlySocialLimiter.on('failed', async () => {
  console.error(`🔴 [Rate Limiter] Request failed, retrying in 5s...`);
  return 5000; // Retry dopo 5 secondi
});

export default onlySocialLimiter;
