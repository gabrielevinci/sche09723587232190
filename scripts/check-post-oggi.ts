import { PrismaClient } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';

const prisma = new PrismaClient();

async function checkPostsToday() {
  try {
    console.log('🔍 Cercando post del 09/12/2025...\n');
    
    // Prende tutti i post di oggi
    const posts = await prisma.scheduledPost.findMany({
      where: {
        scheduledFor: {
          gte: new Date('2025-12-09T00:00:00.000Z'),
          lte: new Date('2025-12-09T23:59:59.999Z')
        }
      },
      orderBy: {
        scheduledFor: 'asc'
      }
    });
    
    console.log(`📊 Trovati ${posts.length} post per oggi\n`);
    
    for (const post of posts) {
      const oraItaliana = formatInTimeZone(post.scheduledFor, 'Europe/Rome', 'HH:mm:ss');
      const dataItaliana = formatInTimeZone(post.scheduledFor, 'Europe/Rome', 'yyyy-MM-dd HH:mm:ss');
      
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`ID: ${post.id}`);
      console.log(`Status: ${post.status}`);
      console.log(`Ora italiana: ${oraItaliana}`);
      console.log(`Data completa (Italia): ${dataItaliana}`);
      console.log(`UTC raw: ${post.scheduledFor.toISOString()}`);
      console.log(`Timezone campo: ${post.timezone}`);
      console.log(`Caption: ${post.caption.substring(0, 50)}...`);
      if (post.errorMessage) {
        console.log(`⚠️ Errore: ${post.errorMessage}`);
      }
      console.log('');
    }
    
    // Adesso verifica la query del Lambda
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 SIMULAZIONE QUERY LAMBDA (ore 09:00 UTC = 10:00 Italia)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const nowUTC = new Date('2025-12-09T09:00:00.000Z'); // Simula le 09:00 UTC (10:00 Italia)
    const sixHoursAgo = new Date(nowUTC.getTime() - (360 * 60 * 1000));
    const sixtyFiveMinutesFromNow = new Date(nowUTC.getTime() + (65 * 60 * 1000));
    
    console.log(`Now UTC: ${nowUTC.toISOString()}`);
    console.log(`Now Italia: ${formatInTimeZone(nowUTC, 'Europe/Rome', 'yyyy-MM-dd HH:mm:ss')}`);
    console.log(`Finestra: ${sixHoursAgo.toISOString()} → ${sixtyFiveMinutesFromNow.toISOString()}`);
    console.log(`Finestra Italia: ${formatInTimeZone(sixHoursAgo, 'Europe/Rome', 'HH:mm')} → ${formatInTimeZone(sixtyFiveMinutesFromNow, 'Europe/Rome', 'HH:mm')}\n`);
    
    const postsInWindow = await prisma.scheduledPost.findMany({
      where: {
        status: 'PENDING',
        scheduledFor: {
          gte: sixHoursAgo,
          lte: sixtyFiveMinutesFromNow
        }
      },
      orderBy: {
        scheduledFor: 'asc'
      }
    });
    
    console.log(`📊 Post trovati nella finestra: ${postsInWindow.length}\n`);
    
    for (const post of postsInWindow) {
      const oraItaliana = formatInTimeZone(post.scheduledFor, 'Europe/Rome', 'HH:mm:ss');
      console.log(`- ${post.id.substring(0, 8)}... | ${post.status} | ${oraItaliana} | ${post.caption.substring(0, 30)}...`);
    }
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPostsToday();
