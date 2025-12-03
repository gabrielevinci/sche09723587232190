/**
 * OnlySocial Account Status Sync
 * 
 * Verifica lo stato di autorizzazione degli account OnlySocial tramite API
 * e aggiorna il campo isActive nel database locale
 */

import { prisma } from '@/lib/prisma';

interface OnlySocialAccount {
  id: number;
  uuid: string;
  name: string;
  username: string;
  provider: string;
  authorized: boolean;
  created_at: string;
}

interface OnlySocialAPIResponse {
  data: OnlySocialAccount[];
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti in millisecondi
const API_TIMEOUT = 10000; // 10 secondi timeout

/**
 * Verifica se un account necessita di controllo stato
 */
async function shouldCheckAccountStatus(accountId: string): Promise<boolean> {
  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
    select: { updatedAt: true }
  });

  if (!account) return false;

  const timeSinceLastCheck = Date.now() - account.updatedAt.getTime();
  return timeSinceLastCheck > CACHE_DURATION;
}

/**
 * Recupera lo stato degli account da OnlySocial API
 */
async function fetchOnlySocialAccountsStatus(): Promise<OnlySocialAccount[]> {
  const workspaceUuid = process.env.ONLYSOCIAL_WORKSPACE_UUID;
  const apiToken = process.env.ONLYSOCIAL_API_TOKEN;

  if (!workspaceUuid || !apiToken) {
    console.error('❌ [OnlySocial Sync] Missing credentials in environment');
    throw new Error('OnlySocial credentials not configured');
  }

  const url = `https://app.onlysocial.io/os/api/${workspaceUuid}/accounts`;

  console.log('📡 [OnlySocial Sync] Fetching accounts status from API...');
  console.log('   → URL:', url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('❌ [OnlySocial Sync] API request failed:', response.status, response.statusText);
      throw new Error(`OnlySocial API error: ${response.status}`);
    }

    const data: OnlySocialAPIResponse = await response.json();
    console.log(`✅ [OnlySocial Sync] Received ${data.data?.length || 0} accounts from API`);

    return data.data || [];
  } catch (error) {
    clearTimeout(timeoutId);
    
    if ((error as Error).name === 'AbortError') {
      console.error('❌ [OnlySocial Sync] API request timeout');
      throw new Error('OnlySocial API timeout');
    }
    
    throw error;
  }
}

/**
 * Aggiorna lo stato di un account nel database
 */
async function updateAccountStatus(
  accountId: string,
  isActive: boolean,
  reason: string
): Promise<void> {
  console.log(`📝 [OnlySocial Sync] Updating account ${accountId}:`, {
    isActive,
    reason
  });

  await prisma.socialAccount.update({
    where: { id: accountId },
    data: {
      isActive,
      updatedAt: new Date(), // Aggiorna timestamp per il caching
    },
  });

  console.log(`✅ [OnlySocial Sync] Account ${accountId} updated successfully`);
}

/**
 * Verifica e aggiorna lo stato di tutti gli account OnlySocial di un utente
 * 
 * @param userId - ID dell'utente da verificare
 * @param forceCheck - Se true, bypassa il cache e forza il controllo
 * @returns Numero di account aggiornati
 */
export async function checkAndUpdateAccountsStatus(
  userId: string,
  forceCheck: boolean = false
): Promise<{ updated: number; total: number; errors: string[] }> {
  console.log('🔍 [OnlySocial Sync] Starting accounts status check for user:', userId);
  
  const errors: string[] = [];
  let updatedCount = 0;

  try {
    // 1. Recupera gli account OnlySocial dell'utente dal database tramite AdminAssociation
    const adminAssociations = await prisma.adminAssociation.findMany({
      where: {
        userId: userId,
        isActive: true, // Solo associazioni attive
      },
      include: {
        socialAccount: {
          select: {
            id: true,
            accountId: true,
            accountUuid: true,
            accountName: true,
            platform: true,
            isActive: true,
            updatedAt: true,
          }
        }
      }
    });

    // Estrai solo gli account con accountId (account OnlySocial)
    const userAccounts = adminAssociations
      .map(assoc => assoc.socialAccount)
      .filter(account => account.accountId && account.accountId !== '');

    console.log(`📊 [OnlySocial Sync] Found ${userAccounts.length} OnlySocial accounts in database`);
    
    if (userAccounts.length > 0) {
      console.log('   → Accounts to check:', userAccounts.map(acc => ({
        name: acc.accountName,
        id: acc.accountId,
        uuid: acc.accountUuid,
        isActive: acc.isActive,
        platform: acc.platform
      })));
    }

    if (userAccounts.length === 0) {
      console.log('ℹ️  [OnlySocial Sync] No OnlySocial accounts to check');
      return { updated: 0, total: 0, errors: [] };
    }

    // 2. Verifica se serve il check (cache)
    if (!forceCheck) {
      const accountsNeedingCheck = await Promise.all(
        userAccounts.map(acc => shouldCheckAccountStatus(acc.id))
      );

      const needsCheck = accountsNeedingCheck.some(needs => needs);
      
      if (!needsCheck) {
        console.log('⏭️  [OnlySocial Sync] All accounts recently checked, skipping (cache valid)');
        return { updated: 0, total: userAccounts.length, errors: [] };
      }
    }

    // 3. Recupera stato da OnlySocial API
    let onlySocialAccounts: OnlySocialAccount[];
    
    try {
      onlySocialAccounts = await fetchOnlySocialAccountsStatus();
    } catch (error) {
      const errorMsg = `Failed to fetch OnlySocial API: ${(error as Error).message}`;
      console.error('❌ [OnlySocial Sync]', errorMsg);
      errors.push(errorMsg);
      // Non bloccare, ritorna con errore
      return { updated: 0, total: userAccounts.length, errors };
    }

    // 4. Per ogni account utente, verifica e aggiorna stato
    for (const userAccount of userAccounts) {
      try {
        // Cerca l'account su OnlySocial (match per accountId o accountUuid)
        const onlySocialAccount = onlySocialAccounts.find(
          acc => 
            acc.id.toString() === userAccount.accountId ||
            acc.uuid === userAccount.accountUuid
        );

        if (!onlySocialAccount) {
          // Account non trovato su OnlySocial - potrebbe essere stato eliminato
          const errorMsg = `Account ${userAccount.accountName} (${userAccount.accountId}) not found on OnlySocial`;
          console.warn('⚠️  [OnlySocial Sync]', errorMsg);
          errors.push(errorMsg);
          
          // Opzionale: disattiva l'account se non esiste più
          if (userAccount.isActive) {
            await updateAccountStatus(
              userAccount.id,
              false,
              'Account not found on OnlySocial'
            );
            updatedCount++;
          }
          continue;
        }

        // Verifica se lo stato è cambiato
        const isAuthorized = onlySocialAccount.authorized;
        
        if (userAccount.isActive !== isAuthorized) {
          console.log(`🔄 [OnlySocial Sync] Status changed for ${userAccount.accountName}:`, {
            before: userAccount.isActive,
            after: isAuthorized,
            authorized: onlySocialAccount.authorized
          });

          await updateAccountStatus(
            userAccount.id,
            isAuthorized,
            isAuthorized ? 'Authorized on OnlySocial' : 'Not authorized on OnlySocial'
          );
          
          updatedCount++;
        } else {
          console.log(`✓ [OnlySocial Sync] No change for ${userAccount.accountName} (${isAuthorized ? 'active' : 'inactive'})`);
          
          // Aggiorna solo il timestamp per il caching
          await prisma.socialAccount.update({
            where: { id: userAccount.id },
            data: { updatedAt: new Date() }
          });
        }
      } catch (error) {
        const errorMsg = `Error processing account ${userAccount.accountName}: ${(error as Error).message}`;
        console.error('❌ [OnlySocial Sync]', errorMsg);
        errors.push(errorMsg);
      }
    }

    console.log('✅ [OnlySocial Sync] Check completed:', {
      total: userAccounts.length,
      updated: updatedCount,
      errors: errors.length
    });

    return {
      updated: updatedCount,
      total: userAccounts.length,
      errors
    };

  } catch (error) {
    const errorMsg = `Unexpected error during sync: ${(error as Error).message}`;
    console.error('❌ [OnlySocial Sync]', errorMsg);
    errors.push(errorMsg);
    
    return {
      updated: updatedCount,
      total: 0,
      errors
    };
  }
}

/**
 * Helper per verificare lo stato di un singolo account
 */
export async function checkSingleAccountStatus(
  accountId: string
): Promise<boolean | null> {
  try {
    const account = await prisma.socialAccount.findUnique({
      where: { id: accountId },
      select: {
        accountId: true,
        accountUuid: true,
        userId: true,
      }
    });

    if (!account || !account.userId) {
      console.error('❌ [OnlySocial Sync] Account not found or has no userId');
      return null;
    }

    const result = await checkAndUpdateAccountsStatus(account.userId, true);
    
    // Recupera lo stato aggiornato
    const updatedAccount = await prisma.socialAccount.findUnique({
      where: { id: accountId },
      select: { isActive: true }
    });

    return updatedAccount?.isActive ?? null;
  } catch (error) {
    console.error('❌ [OnlySocial Sync] Error checking single account:', error);
    return null;
  }
}
