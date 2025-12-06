/**
 * AWS Lambda Handler - OnlySocial Scheduler
 * 
 * Gestisce:
 * 1. Cron job scheduling (trigger da Cron-Job.org)
 * 2. Chiamate API OnlySocial con rate limiting (max 25 req/min)
 * 3. Aggiornamento database Neon
 */

import { prisma } from './prisma-client';
import { uploadVideoToOnlySocial, createOnlySocialPost, scheduleOnlySocialPost } from './onlysocial-client';
import { formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'Europe/Rome';

// Tipi per Lambda (inline per evitare dipendenza da @types/aws-lambda in runtime)
interface LambdaEvent {
  body?: string;
  queryStringParameters?: Record<string, string>;
}

interface LambdaResult {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

/**
 * Handler principale Lambda
 */
export const handler = async (event: LambdaEvent): Promise<LambdaResult> => {
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
    const action = body.action || event.queryStringParameters?.action || 'schedule';
    
    console.log(`📋 [Lambda] Action: ${action}`);
    
    let result: LambdaResult;
    
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
      
      default:
        result = {
          statusCode: 400,
          body: JSON.stringify({
            error: `Unknown action: ${action}`,
            availableActions: ['schedule', 'health', 'warm']
          })
        };
    }
    
    return { ...result, headers };
    
  } catch (error) {
    console.error('❌ [Lambda] Fatal error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  } finally {
    // Disconnetti Prisma per evitare connessioni hanging
    await prisma.$disconnect();
  }
};

/**
 * Health check endpoint
 */
async function handleHealthCheck(): Promise<LambdaResult> {
  console.log('🏥 [Lambda] Health check');
  
  try {
    // Test connessione DB
    await prisma.$queryRaw`SELECT 1`;
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
        rateLimit: 'configured (25 req/min)'
      })
    };
  } catch (error) {
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
async function handleWarmup(): Promise<LambdaResult> {
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
 * Handler cron job - schedula video su OnlySocial
 */
async function handleScheduleCronJob(): Promise<LambdaResult> {
  console.log('⏰ [Lambda] Processing scheduled videos...');
  
  const now = new Date();
  const results = {
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [] as string[]
  };
  
  try {
    // 1. Query video da schedulare (status PENDING, scheduledFor <= now)
    const videosToSchedule = await prisma.scheduledPost.findMany({
      where: {
        status: 'PENDING',
        scheduledFor: {
          lte: now
        }
      },
      orderBy: {
        scheduledFor: 'asc'
      },
      take: 25 // Limita a 25 per rispettare rate limit di 25 req/min
    });
    
    console.log(`📊 [Lambda] Found ${videosToSchedule.length} videos to schedule`);
    
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
      
      try {
        console.log(`\n📹 [Lambda] Processing video ${results.processed}/${videosToSchedule.length}`);
        console.log(`   ID: ${video.id}`);
        console.log(`   Scheduled: ${formatInTimeZone(video.scheduledFor, TIMEZONE, 'yyyy-MM-dd HH:mm')}`);
        
        // Recupera SocialAccount separatamente
        const socialAccount = await prisma.socialAccount.findUnique({
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
        
        // Usa accountId dallo ScheduledPost (già numerico) o dal SocialAccount
        const accountId = video.accountId || parseInt(socialAccount.accountId);
        if (!accountId || isNaN(accountId)) {
          throw new Error(`Invalid accountId: ${video.accountId || socialAccount.accountId}`);
        }
        
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
        const uploadResult = await uploadVideoToOnlySocial({
          videoUrl: videoUrl,
          filename: videoFilename
        });
        
        const mediaId = parseInt(uploadResult.id);
        if (isNaN(mediaId)) {
          throw new Error(`Invalid media ID from OnlySocial: ${uploadResult.id}`);
        }
        
        // Step 2: Crea post
        console.log(`   2/3 Creating post...`);
        const postResult = await createOnlySocialPost({
          accountId: accountId,
          mediaId: mediaId,
          caption: video.caption,
          postType: video.postType,
          scheduledFor: video.scheduledFor
        });
        
        // Step 3: Schedula post
        console.log(`   3/3 Scheduling post...`);
        await scheduleOnlySocialPost({
          postUuid: postResult.uuid
        });
        
        // Aggiorna database: SCHEDULED
        await prisma.scheduledPost.update({
          where: { id: video.id },
          data: {
            status: 'SCHEDULED',
            onlySocialMediaIds: [mediaId],
            onlySocialPostUuid: postResult.uuid,
            onlySocialMediaUrl: uploadResult.url,
            updatedAt: new Date()
          }
        });
        
        results.successful++;
        console.log(`✅ [Lambda] Video ${video.id} scheduled successfully`);
        
      } catch (error) {
        results.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Video ${video.id}: ${errorMsg}`);
        
        console.error(`❌ [Lambda] Failed to schedule video ${video.id}:`, errorMsg);
        
        // Aggiorna database: FAILED
        await prisma.scheduledPost.update({
          where: { id: video.id },
          data: {
            status: 'FAILED',
            errorMessage: errorMsg,
            retryCount: { increment: 1 },
            updatedAt: new Date()
          }
        }).catch(err => {
          console.error(`Failed to update status for video ${video.id}:`, err);
        });
      }
    }
    
    // Risultato finale
    console.log(`\n📊 [Lambda] Processing complete:`);
    console.log(`   Processed: ${results.processed}`);
    console.log(`   Successful: ${results.successful}`);
    console.log(`   Failed: ${results.failed}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        results: results,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
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
