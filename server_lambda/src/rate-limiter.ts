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

// Logs per monitoring
onlySocialLimiter.on('failed', async (error, jobInfo) => {
  console.error(`🔴 [Rate Limiter] Request failed:`, error);
  console.error(`   Job:`, jobInfo);
  
  // Retry automatico dopo 5 secondi se fallisce
  if (jobInfo.retryCount < 3) {
    console.log(`   Retry ${jobInfo.retryCount + 1}/3 in 5 seconds...`);
    return 5000; // Ritenta dopo 5 secondi
  }
});

onlySocialLimiter.on('retry', (error, jobInfo) => {
  console.log(`🔄 [Rate Limiter] Retrying request (attempt ${jobInfo.retryCount + 1})`);
});

onlySocialLimiter.on('queued', (info) => {
  if (info && info > 0) {
    console.log(`⏳ [Rate Limiter] ${info} requests queued`);
  }
});

onlySocialLimiter.on('executing', (info) => {
  console.log(`⚡ [Rate Limiter] Executing request (${onlySocialLimiter.counts().EXECUTING}/${onlySocialLimiter.counts().QUEUED + onlySocialLimiter.counts().EXECUTING} total)`);
});

export default onlySocialLimiter;
