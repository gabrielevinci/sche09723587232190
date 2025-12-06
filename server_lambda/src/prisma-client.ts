/**
 * Prisma Client per Lambda
 * Configurazione semplificata per Neon PostgreSQL
 */

import { PrismaClient } from '@prisma/client';

// Singleton Prisma Client
// Importante per Lambda: riusa connessioni tra invocazioni nello stesso container
let prisma: PrismaClient;

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
  });
} else {
  // In development, evita multiple istanze durante hot-reload
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: ['query', 'error', 'warn'],
    });
  }
  prisma = global.__prisma;
}

export { prisma };
