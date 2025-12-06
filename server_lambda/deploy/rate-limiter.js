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
// Log semplice per errori (no TypeScript issues)
exports.onlySocialLimiter.on('failed', async () => {
    console.error(`🔴 [Rate Limiter] Request failed, retrying in 5s...`);
    return 5000; // Retry dopo 5 secondi
});
exports.default = exports.onlySocialLimiter;
