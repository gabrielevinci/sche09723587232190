"use strict";
/**
 * Prisma Client per Lambda
 * Configurazione semplificata per Neon PostgreSQL
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
// Singleton Prisma Client
// Importante per Lambda: riusa connessioni tra invocazioni nello stesso container
let prisma;
if (process.env.NODE_ENV === 'production') {
    exports.prisma = prisma = new client_1.PrismaClient({
        log: ['error', 'warn'],
    });
}
else {
    // In development, evita multiple istanze durante hot-reload
    if (!global.__prisma) {
        global.__prisma = new client_1.PrismaClient({
            log: ['query', 'error', 'warn'],
        });
    }
    exports.prisma = prisma = global.__prisma;
}
