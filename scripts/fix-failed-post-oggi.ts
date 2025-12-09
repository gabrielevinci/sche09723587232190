import { PrismaClient } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';

const prisma = new PrismaClient();

async function fixFailedPost() {
  try {
    console.log('🔧 Correzione post FAILED del 09/12 alle 10:45...\n');
    
    // Il post è alle 11:45 Italia (10:45 UTC) e risulta FAILED
    const failedPost = await prisma.scheduledPost.findFirst({
      where: {
        id: 'cmiwsb4zp001fjs04d5kumfia' // ID del post dalle 11:45 (era 10:45 programmato)
      }
    });
    
    if (!failedPost) {
      console.log('❌ Post non trovato');
      return;
    }
    
    console.log(`📊 Post trovato:`);
    console.log(`   ID: ${failedPost.id}`);
    console.log(`   Status: ${failedPost.status}`);
    console.log(`   Ora italiana ATTUALE: ${formatInTimeZone(failedPost.scheduledFor, 'Europe/Rome', 'HH:mm')}`);
    console.log(`   UTC ATTUALE: ${failedPost.scheduledFor.toISOString()}`);
    console.log(`   Errore: ${failedPost.errorMessage}`);
    
    // Correggi l'orario (-1h) e metti PENDING
    const correctDate = new Date(failedPost.scheduledFor.getTime() - (60 * 60 * 1000));
    
    console.log(`\n🔧 Correzione:`);
    console.log(`   Nuova ora italiana: ${formatInTimeZone(correctDate, 'Europe/Rome', 'HH:mm')}`);
    console.log(`   Nuovo UTC: ${correctDate.toISOString()}`);
    console.log(`   Nuovo status: PENDING`);
    
    await prisma.scheduledPost.update({
      where: { id: failedPost.id },
      data: {
        scheduledFor: correctDate,
        status: 'PENDING',
        errorMessage: null,
        retryCount: 0,
        updatedAt: new Date()
      }
    });
    
    console.log(`\n✅ Post corretto e rimesso in PENDING!`);
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixFailedPost();
