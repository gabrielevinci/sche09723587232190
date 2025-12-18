"use strict";
/**
 * AWS Lambda Handler - OnlySocial Scheduler
 *
 * Gestisce:
 * 1. Cron job scheduling (trigger da Cron-Job.org)
 * 2. Chiamate API OnlySocial con rate limiting (max 25 req/min)
 * 3. Aggiornamento database Neon
 * 4. Verifica stato account OnlySocial (proxy per Vercel)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const prisma_client_1 = require("./prisma-client");
const onlysocial_client_1 = require("./onlysocial-client");
const date_fns_tz_1 = require("date-fns-tz");
const TIMEZONE = 'Europe/Rome';
/**
 * Handler principale Lambda
 */
const handler = async (event) => {
    console.log('🚀 [Lambda] OnlySocial Scheduler started');
    console.log('   Event:', JSON.stringify(event, null, 2));
    // Headers CORS per API Gateway
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    };
    try {
        // Parsing del body
        const body = event.body ? JSON.parse(event.body) : {};
        // Rileva se la chiamata viene da cron-job.org (usa sempre 'schedule')
        const userAgent = event.headers?.['user-agent'] || '';
        const isCronJob = userAgent.includes('cron-job.org');
        // Se viene da cron-job.org, forza action='schedule' indipendentemente dal body
        const action = isCronJob ? 'schedule' : (body.action || event.queryStringParameters?.action || 'schedule');
        console.log(`📋 [Lambda] Action: ${action}${isCronJob ? ' (forced by cron-job.org)' : ''}`);
        let result;
        switch (action) {
            case 'schedule':
                result = await handleScheduleCronJob();
                break;
            case 'health':
                result = await handleHealthCheck();
                break;
            case 'warm':
                result = await handleWarmup();
                break;
            case 'check-accounts':
                result = await handleCheckAccounts();
                break;
            default:
                result = {
                    statusCode: 400,
                    body: JSON.stringify({
                        error: `Unknown action: ${action}`,
                        availableActions: ['schedule', 'health', 'warm', 'check-accounts']
                    })
                };
        }
        return { ...result, headers };
    }
    catch (error) {
        console.error('❌ [Lambda] Fatal error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
    finally {
        // Disconnetti Prisma per evitare connessioni hanging
        await prisma_client_1.prisma.$disconnect();
    }
};
exports.handler = handler;
/**
 * Health check endpoint
 */
async function handleHealthCheck() {
    console.log('🏥 [Lambda] Health check');
    try {
        // Test connessione DB
        await prisma_client_1.prisma.$queryRaw `SELECT 1`;
        return {
            statusCode: 200,
            body: JSON.stringify({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                database: 'connected',
                rateLimit: 'configured (25 req/min)'
            })
        };
    }
    catch (error) {
        return {
            statusCode: 503,
            body: JSON.stringify({
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
}
/**
 * Warmup endpoint - previene cold start
 */
async function handleWarmup() {
    console.log('🔥 [Lambda] Warmup ping');
    return {
        statusCode: 200,
        body: JSON.stringify({
            status: 'warm',
            timestamp: new Date().toISOString()
        })
    };
}
/**
 * Check accounts endpoint - verifica stato account OnlySocial
 * Chiamato da Vercel per evitare chiamate dirette a OnlySocial
 */
async function handleCheckAccounts() {
    console.log('📡 [Lambda] Checking OnlySocial accounts status...');
    try {
        // Fetch accounts da OnlySocial API
        const onlySocialAccounts = await (0, onlysocial_client_1.fetchOnlySocialAccounts)();
        // Restituisci la lista a Vercel
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                accounts: onlySocialAccounts,
                count: onlySocialAccounts.length,
                timestamp: new Date().toISOString()
            })
        };
    }
    catch (error) {
        console.error('❌ [Lambda] Failed to check accounts:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                accounts: []
            })
        };
    }
}
/**
 * Handler cron job - schedula video su OnlySocial
 *
 * Logica (ogni ora):
 * 1. Controlla post PENDING con scheduledFor nelle prossime 60 min (now → now+60')
 *    → Carica su OnlySocial e schedula per la data prevista
 * 2. Controlla post PENDING con scheduledFor nell'ultima ora (now-60' → now)
 *    → Recupera post mancati per errori, li pubblica subito (postNow: true)
 */
async function handleScheduleCronJob() {
    console.log('⏰ [Lambda] Processing scheduled videos...');
    // IMPORTANTE: Il database salva le date in ora italiana (Europe/Rome) come "timestamp without time zone"
    // Quindi dobbiamo confrontare usando l'ora italiana, non UTC
    // Costruiamo una data "fake" che rappresenta l'ora italiana corrente come se fosse UTC
    // Questo permette il confronto corretto con i valori nel database
    const nowUTC = new Date();
    // Ottieni l'ora italiana formattata
    const italianTimeStr = (0, date_fns_tz_1.formatInTimeZone)(nowUTC, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
    // Crea un oggetto Date che rappresenta l'ora italiana (ma JavaScript lo tratterà come UTC)
    // Questo è necessario perché il database restituisce timestamp without timezone che Prisma interpreta come UTC
    const nowItalian = new Date(italianTimeStr + 'Z');
    // Finestra temporale basata su ora italiana:
    // - Recovery: 360 minuti indietro (6 ore) per recuperare post mancati
    // - Upcoming: 65 minuti avanti per processare i prossimi post
    const sixHoursAgo = new Date(nowItalian.getTime() - (360 * 60 * 1000)); // -6h
    const sixtyFiveMinutesFromNow = new Date(nowItalian.getTime() + (65 * 60 * 1000)); // +65min
    const results = {
        processed: 0,
        successful: 0,
        failed: 0,
        scheduled: 0, // Post schedulati per il futuro
        publishedNow: 0, // Post pubblicati subito (recupero)
        errors: []
    };
    try {
        console.log(`🔍 [Lambda] Time window (Italian timezone):`);
        console.log(`   UTC now: ${nowUTC.toISOString()}`);
        console.log(`   Italian now: ${italianTimeStr}`);
        console.log(`   Query window: ${sixHoursAgo.toISOString()} to ${sixtyFiveMinutesFromNow.toISOString()}`);
        console.log(`   Recovery (-6h): from ${(0, date_fns_tz_1.formatInTimeZone)(new Date(sixHoursAgo.toISOString().slice(0, -1)), 'UTC', 'HH:mm')} to ${italianTimeStr.slice(11, 16)} (ora italiana)`);
        console.log(`   Upcoming (+65min): from ${italianTimeStr.slice(11, 16)} to ${(0, date_fns_tz_1.formatInTimeZone)(new Date(sixtyFiveMinutesFromNow.toISOString().slice(0, -1)), 'UTC', 'HH:mm')} (ora italiana)`);
        // Query: post PENDING o FAILED nella finestra -360' → +65' (include retry dei falliti)
        const videosToSchedule = await prisma_client_1.prisma.scheduledPost.findMany({
            where: {
                status: {
                    in: ['PENDING', 'FAILED'] // Include anche i FAILED per retry (recovery)
                },
                scheduledFor: {
                    gte: sixHoursAgo, // Da 6 ore fa (recupero mancati)
                    lte: sixtyFiveMinutesFromNow // Fino a 65 min nel futuro (prossimi post)
                }
            },
            orderBy: {
                scheduledFor: 'asc'
            },
            take: 25 // Limita a 25 per rispettare rate limit di 25 req/min
        });
        console.log(`📊 [Lambda] Found ${videosToSchedule.length} videos to process`);
        if (videosToSchedule.length === 0) {
            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'No videos to schedule',
                    processed: 0
                })
            };
        }
        // 2. Processa ogni video
        for (const video of videosToSchedule) {
            results.processed++;
            // Determina se il post è scaduto (scheduledFor < ora italiana corrente) o futuro
            // video.scheduledFor viene dal DB come timestamp che rappresenta ora italiana
            const isOverdue = video.scheduledFor < nowItalian;
            // Estrai l'ora italiana dalla data (il valore è già in ora italiana, ma JS lo vede come UTC)
            const scheduledHHMM = video.scheduledFor.toISOString().slice(11, 16);
            try {
                // Log compatto per velocità
                console.log(`📹 [${results.processed}/${videosToSchedule.length}] ${video.id} - ${isOverdue ? 'NOW' : 'SCHEDULE'} ${scheduledHHMM} (ora italiana)`);
                // Recupera SocialAccount separatamente
                const socialAccount = await prisma_client_1.prisma.socialAccount.findUnique({
                    where: { id: video.socialAccountId }
                });
                if (!socialAccount) {
                    throw new Error(`SocialAccount not found: ${video.socialAccountId}`);
                }
                // Verifica che l'account sia attivo
                if (!socialAccount.isActive) {
                    throw new Error(`Account ${socialAccount.accountName} is not active`);
                }
                // Usa accountId numerico - OnlySocial richiede l'ID intero nell'API, non l'UUID
                const accountId = parseInt(socialAccount.accountId);
                if (isNaN(accountId)) {
                    throw new Error(`Invalid accountId: not a number for account ${socialAccount.accountName} (value: ${socialAccount.accountId})`);
                }
                // Verifica che ci siano video da caricare
                if (!video.videoUrls || video.videoUrls.length === 0) {
                    throw new Error(`No videos to upload for post ${video.id}`);
                }
                // Per ora gestiamo solo il primo video (multi-video in futuro)
                const videoUrl = video.videoUrls[0];
                const videoFilename = video.videoFilenames[0] || `video-${video.id}.mp4`;
                // Step 1: Upload video a OnlySocial
                const uploadResult = await (0, onlysocial_client_1.uploadVideoToOnlySocial)({
                    videoUrl: videoUrl,
                    filename: videoFilename
                });
                const mediaId = parseInt(uploadResult.id);
                if (isNaN(mediaId)) {
                    throw new Error(`Invalid media ID from OnlySocial: ${uploadResult.id}`);
                }
                // Step 2: Crea post
                const postResult = await (0, onlysocial_client_1.createOnlySocialPost)({
                    accountId: accountId,
                    mediaId: mediaId,
                    caption: video.caption,
                    postType: video.postType,
                    scheduledFor: video.scheduledFor
                });
                // Step 3: Schedula post (o pubblica subito se scaduto)
                await (0, onlysocial_client_1.scheduleOnlySocialPost)({
                    postUuid: postResult.uuid,
                    postNow: isOverdue // true = pubblica subito, false = schedula per data prevista
                });
                // Aggiorna database
                const finalStatus = isOverdue ? 'PUBLISHED' : 'SCHEDULED';
                await prisma_client_1.prisma.scheduledPost.update({
                    where: { id: video.id },
                    data: {
                        status: finalStatus,
                        onlySocialMediaIds: [mediaId],
                        onlySocialPostUuid: postResult.uuid,
                        onlySocialMediaUrl: uploadResult.url,
                        publishedAt: isOverdue ? new Date() : null,
                        updatedAt: new Date()
                    }
                });
                results.successful++;
                if (isOverdue) {
                    results.publishedNow++;
                }
                else {
                    results.scheduled++;
                }
                console.log(`✅ ${video.id} → ${finalStatus}`);
            }
            catch (error) {
                results.failed++;
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                results.errors.push(`Video ${video.id}: ${errorMsg}`);
                console.error(`❌ ${video.id} FAILED: ${errorMsg}`);
                // Aggiorna database: FAILED
                await prisma_client_1.prisma.scheduledPost.update({
                    where: { id: video.id },
                    data: {
                        status: 'FAILED',
                        errorMessage: errorMsg,
                        retryCount: { increment: 1 },
                        updatedAt: new Date()
                    }
                }).catch((updateErr) => {
                    console.error(`Failed to update status for video ${video.id}:`, updateErr.message);
                });
            }
        }
        // Risultato finale - Log completo solo in sviluppo
        console.log(`\n📊 [Lambda] Complete: ${results.processed} processed, ${results.scheduled} scheduled, ${results.publishedNow} now, ${results.failed} failed`);
        // Output MINIMO per cron-job.org (max 64KB, ideale <1KB)
        // cron-job.org attende max 30 secondi e legge max 64KB
        const shortResponse = results.failed > 0
            ? `PARTIAL: ${results.successful}/${results.processed} OK, ${results.failed} failed`
            : `OK: ${results.processed} processed`;
        return {
            statusCode: 200,
            body: shortResponse // Response testuale minima, non JSON
        };
    }
    catch (error) {
        console.error('❌ [Lambda] Cron job failed:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                results: results
            })
        };
    }
}
