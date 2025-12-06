"use strict";
/**
 * Rate Limiter per OnlySocial API
 * Limite: max 25 richieste/minuto
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.onlySocialLimiter = void 0;
const bottleneck_1 = __importDefault(require("bottleneck"));
// Rate limiter configurato per 25 req/min
// 60000ms / 25 = 2400ms tra richieste
exports.onlySocialLimiter = new bottleneck_1.default({
    minTime: 2400, // Minimo 2.4 secondi tra richieste
    maxConcurrent: 1, // Una richiesta alla volta
    reservoir: 25, // Max 25 token
    reservoirRefreshAmount: 25,
    reservoirRefreshInterval: 60 * 1000, // Ricarica ogni 60 secondi
});
// Traccia i retry per job
const retryCount = new Map();
const MAX_RETRIES = 3;
// Log errori con dettagli e limite retry
exports.onlySocialLimiter.on('failed', async (error, jobInfo) => {
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
exports.onlySocialLimiter.on('done', (jobInfo) => {
    const jobId = jobInfo.options.id || 'unknown';
    retryCount.delete(jobId);
});
exports.default = exports.onlySocialLimiter;
