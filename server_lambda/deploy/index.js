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
    // IMPORTANTE: Il database salva le date in ora italiana (Europe/Rome, UTC+1)
    // Lambda gira in UTC, quindi dobbiamo aggiungere 1 ora per allinearci
    const nowUTC = new Date();
    const italianOffset = 60 * 60 * 1000; // +1 ora
    const now = new Date(nowUTC.getTime() + italianOffset); // "now" in ora italiana
    const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
    const oneHourFromNow = new Date(now.getTime() + (60 * 60 * 1000));
    const results = {
        processed: 0,
        successful: 0,
        failed: 0,
        scheduled: 0, // Post schedulati per il futuro
        publishedNow: 0, // Post pubblicati subito (recupero)
        errors: []
    };
    try {
        console.log(`🔍 [Lambda] Time window:`);
        console.log(`   Recovery (now-60'): ${(0, date_fns_tz_1.formatInTimeZone)(oneHourAgo, TIMEZONE, 'yyyy-MM-dd HH:mm')} to ${(0, date_fns_tz_1.formatInTimeZone)(now, TIMEZONE, 'yyyy-MM-dd HH:mm')}`);
        console.log(`   Upcoming (now+60'): ${(0, date_fns_tz_1.formatInTimeZone)(now, TIMEZONE, 'yyyy-MM-dd HH:mm')} to ${(0, date_fns_tz_1.formatInTimeZone)(oneHourFromNow, TIMEZONE, 'yyyy-MM-dd HH:mm')}`);
        // Query: post PENDING nella finestra -60' → +60'
        const videosToSchedule = await prisma_client_1.prisma.scheduledPost.findMany({
            where: {
                status: 'PENDING',
                scheduledFor: {
                    gte: oneHourAgo, // Da 1 ora fa (recupero mancati)
                    lte: oneHourFromNow // Fino a 1 ora nel futuro (prossima schedulazione)
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
            // Determina se il post è scaduto (scheduledFor < now) o futuro
            const isOverdue = video.scheduledFor < now;
            try {
                console.log(`\n📹 [Lambda] Processing video ${results.processed}/${videosToSchedule.length}`);
                console.log(`   ID: ${video.id}`);
                console.log(`   Scheduled: ${(0, date_fns_tz_1.formatInTimeZone)(video.scheduledFor, TIMEZONE, 'yyyy-MM-dd HH:mm')}`);
                console.log(`   Type: ${isOverdue ? '⚠️ OVERDUE (will publish now)' : '📅 UPCOMING (will schedule)'}`);
                // Recupera SocialAccount separatamente
                const socialAccount = await prisma_client_1.prisma.socialAccount.findUnique({
                    where: { id: video.socialAccountId }
                });
                if (!socialAccount) {
                    throw new Error(`SocialAccount not found: ${video.socialAccountId}`);
                }
                console.log(`   Account: ${socialAccount.accountName} (${socialAccount.platform})`);
                // Verifica che l'account sia attivo
                if (!socialAccount.isActive) {
                    throw new Error(`Account ${socialAccount.accountName} is not active`);
                }
                // Usa accountUuid - OnlySocial richiede l'UUID dell'account, non l'ID numerico
                const accountUuid = video.accountUuid || socialAccount.accountUuid || socialAccount.accountId;
                if (!accountUuid) {
                    throw new Error(`Invalid accountUuid: missing for account ${socialAccount.accountName}`);
                }
                console.log(`   Account UUID: ${accountUuid}`);
                // Verifica che ci siano video da caricare
                if (!video.videoUrls || video.videoUrls.length === 0) {
                    throw new Error(`No videos to upload for post ${video.id}`);
                }
                // Per ora gestiamo solo il primo video (multi-video in futuro)
                const videoUrl = video.videoUrls[0];
                const videoFilename = video.videoFilenames[0] || `video-${video.id}.mp4`;
                console.log(`   Video URL: ${videoUrl}`);
                // Step 1: Upload video a OnlySocial
                console.log(`   1/3 Uploading video...`);
                const uploadResult = await (0, onlysocial_client_1.uploadVideoToOnlySocial)({
                    videoUrl: videoUrl,
                    filename: videoFilename
                });
                const mediaId = parseInt(uploadResult.id);
                if (isNaN(mediaId)) {
                    throw new Error(`Invalid media ID from OnlySocial: ${uploadResult.id}`);
                }
                // Step 2: Crea post
                console.log(`   2/3 Creating post...`);
                const postResult = await (0, onlysocial_client_1.createOnlySocialPost)({
                    accountUuid: accountUuid,
                    mediaId: mediaId,
                    caption: video.caption,
                    postType: video.postType,
                    scheduledFor: video.scheduledFor
                });
                // Step 3: Schedula post (o pubblica subito se scaduto)
                console.log(`   3/3 ${isOverdue ? 'Publishing now...' : 'Scheduling post...'}`);
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
                    console.log(`✅ [Lambda] Video ${video.id} published NOW (recovery)`);
                }
                else {
                    results.scheduled++;
                    console.log(`✅ [Lambda] Video ${video.id} scheduled for ${(0, date_fns_tz_1.formatInTimeZone)(video.scheduledFor, TIMEZONE, 'yyyy-MM-dd HH:mm')}`);
                }
            }
            catch (error) {
                results.failed++;
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                results.errors.push(`Video ${video.id}: ${errorMsg}`);
                console.error(`❌ [Lambda] Failed to ${isOverdue ? 'publish' : 'schedule'} video ${video.id}:`, errorMsg);
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
        // Risultato finale
        console.log(`\n📊 [Lambda] Processing complete:`);
        console.log(`   Total processed: ${results.processed}`);
        console.log(`   Scheduled for future: ${results.scheduled}`);
        console.log(`   Published now (recovery): ${results.publishedNow}`);
        console.log(`   Failed: ${results.failed}`);
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                results: results,
                timestamp: new Date().toISOString()
            })
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
