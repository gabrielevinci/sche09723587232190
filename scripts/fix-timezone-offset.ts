import { PrismaClient } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';

const prisma = new PrismaClient();

async function fixWrongTimezoneOffset() {
  try {
    console.log('🔧 Correzione offset timezone nei post PENDING...\n');
    
    // Trova tutti i post PENDING (potrebbero avere l'ora sbagliata)
    const pendingPosts = await prisma.scheduledPost.findMany({
      where: {
        status: 'PENDING'
      },
      orderBy: {
        scheduledFor: 'asc'
      }
    });
    
    console.log(`📊 Trovati ${pendingPosts.length} post PENDING\n`);
    
    let corrected = 0;
    
    for (const post of pendingPosts) {
      // Sottrai 1 ora per correggere l'offset sbagliato
      const correctDate = new Date(post.scheduledFor.getTime() - (60 * 60 * 1000));
      
      const oldItalian = formatInTimeZone(post.scheduledFor, 'Europe/Rome', 'HH:mm');
      const newItalian = formatInTimeZone(correctDate, 'Europe/Rome', 'HH:mm');
      
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Post ID: ${post.id.substring(0, 12)}...`);
      console.log(`PRIMA:  UTC ${post.scheduledFor.toISOString()} → Italia ${oldItalian}`);
      console.log(`DOPO:   UTC ${correctDate.toISOString()} → Italia ${newItalian}`);
      console.log(`Caption: ${post.caption.substring(0, 40)}...`);
      
      // Aggiorna il post
      await prisma.scheduledPost.update({
        where: { id: post.id },
        data: {
          scheduledFor: correctDate,
          updatedAt: new Date()
        }
      });
      
      console.log(`✅ Corretto!`);
      corrected++;
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Completato! ${corrected} post corretti`);
    
    // Verifica i post corretti
    console.log(`\n📋 Post PENDING dopo la correzione:\n`);
    
    const fixedPosts = await prisma.scheduledPost.findMany({
      where: {
        status: 'PENDING'
      },
      orderBy: {
        scheduledFor: 'asc'
      }
    });
    
    for (const post of fixedPosts) {
      const italian = formatInTimeZone(post.scheduledFor, 'Europe/Rome', 'HH:mm');
      console.log(`- ${italian} (UTC: ${post.scheduledFor.toISOString()}) | ${post.caption.substring(0, 30)}...`);
    }
    
  } catch (error) {
    console.error('❌ Errore:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixWrongTimezoneOffset();
