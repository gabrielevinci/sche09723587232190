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

// Traccia i retry per job
const retryCount = new Map<string, number>();
const MAX_RETRIES = 3;

// Log errori con dettagli e limite retry
onlySocialLimiter.on('failed', async (error, jobInfo) => {
  const jobId = jobInfo.options.id || 'unknown';
  const currentRetries = (retryCount.get(jobId) || 0) + 1;
  retryCount.set(jobId, currentRetries);
  
  console.error(`🔴 [Rate Limiter] Request failed (attempt ${currentRetries}/${MAX_RETRIES})`);
  console.error(`   Error: ${error?.message || error}`);
  
  if (currentRetries >= MAX_RETRIES) {
    console.error(`❌ [Rate Limiter] Max retries reached, giving up`);
    retryCount.delete(jobId);
    return null; // Non ritentare
  }
  
  return 5000; // Retry dopo 5 secondi
});

onlySocialLimiter.on('done', (jobInfo) => {
  const jobId = jobInfo.options.id || 'unknown';
  retryCount.delete(jobId);
});

export default onlySocialLimiter;
