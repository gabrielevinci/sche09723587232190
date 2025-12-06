/**
 * OnlySocial API Client per Lambda
 * Gestisce tutte le chiamate API a OnlySocial con rate limiting
 * 
 * IMPORTANTE: Headers puliti - nessun riferimento a Vercel
 */

import { onlySocialLimiter } from './rate-limiter';

const ONLYSOCIAL_API_TOKEN = process.env.ONLYSOCIAL_API_TOKEN || process.env.ONLYSOCIAL_API_KEY;
const ONLYSOCIAL_WORKSPACE_UUID = process.env.ONLYSOCIAL_WORKSPACE_UUID;

if (!ONLYSOCIAL_API_TOKEN || !ONLYSOCIAL_WORKSPACE_UUID) {
  throw new Error('OnlySocial API credentials not configured');
}

const BASE_URL = `https://app.onlysocial.io/os/api/${ONLYSOCIAL_WORKSPACE_UUID}`;

// Headers puliti - NESSUN riferimento a Vercel o altre origini
const getCleanHeaders = () => ({
  'Authorization': `Bearer ${ONLYSOCIAL_API_TOKEN}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'OnlySocialScheduler/1.0',
  // NO Origin, NO Referer - OnlySocial vede solo Lambda
});

interface UploadVideoResult {
  id: string;
  uuid: string;
  name: string;
  mime_type: string;
  type: string;
  url: string;
  thumb_url: string;
  is_video: boolean;
  created_at: string;
}

interface CreatePostResult {
  id: number;
  uuid: string;
  name: string;
  hex_color: string;
}

interface SchedulePostResult {
  success: boolean;
  scheduled_at: string;
  needs_approval: boolean;
}

interface OnlySocialAccount {
  id: number;
  uuid: string;
  name: string;
  username: string;
  provider: string;
  authorized: boolean;
  created_at: string;
}

/**
 * Upload video da URL (Digital Ocean) a OnlySocial
 */
async function _uploadVideoToOnlySocial({ 
  videoUrl, 
  filename 
}: { 
  videoUrl: string; 
  filename: string; 
}): Promise<UploadVideoResult> {
  console.log(`📤 [OnlySocial] Downloading video from: ${videoUrl}`);
  
  // Scarica video da Digital Ocean
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Failed to download video: ${videoResponse.statusText}`);
  }
  
  const videoBlob = await videoResponse.blob();
  console.log(`✅ [OnlySocial] Video downloaded: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);
  
  // Prepara FormData
  const formData = new FormData();
  formData.append('file', videoBlob, filename);
  formData.append('alt_text', filename);
  
  console.log(`📤 [OnlySocial] Uploading to OnlySocial...`);
  
  // Upload - nota: per FormData non serve Content-Type (browser/node lo setta automaticamente)
  const response = await fetch(`${BASE_URL}/media`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ONLYSOCIAL_API_TOKEN}`,
      'Accept': 'application/json',
      'User-Agent': 'OnlySocialScheduler/1.0',
    },
    body: formData
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OnlySocial upload failed: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json() as UploadVideoResult;
  console.log(`✅ [OnlySocial] Video uploaded - ID: ${result.id}`);
  
  return result;
}

/**
 * Crea post su OnlySocial
 */
async function _createOnlySocialPost({
  accountUuid,
  mediaId,
  caption,
  postType,
  scheduledFor
}: {
  accountUuid: string;
  mediaId: number;
  caption: string;
  postType: string;
  scheduledFor: Date;
}): Promise<CreatePostResult> {
  // Formato data/ora per OnlySocial
  const date = scheduledFor.toISOString().split('T')[0]; // "2025-12-06"
  const timeString = scheduledFor.toTimeString().split(' ')[0];
  const time = timeString.split(':').slice(0, 2).join(':'); // "14:30"
  
  console.log(`📝 [OnlySocial] Creating post for account ${accountUuid}`);
  console.log(`   Date: ${date}, Time: ${time}, Media ID: ${mediaId}`);
  
  const payload = {
    accounts: [accountUuid],
    versions: [{
      account_id: 0,
      is_original: true,
      content: [{
        body: caption,
        media: [mediaId],
        url: ""
      }],
      options: {
        instagram: { type: postType === 'story' ? 'story' : postType, collaborators: [] },
        instagram_direct: { type: postType === 'story' ? 'story' : postType, collaborators: [] },
        facebook_page: { type: "post" },
        threads: { is_carousel: false },
        mastodon: { sensitive: false },
        blue_sky: { tags: [] },
        youtube: { title: "", status: "public" },
        linkedin: { visibility: "PUBLIC", document: null, document_title: null },
        linkedin_page: { visibility: "PUBLIC", document: null, document_title: null },
        pinterest: { title: "", link: "", boards: { "account-0": null } },
        reddit: {
          title: null,
          link: null,
          subreddits: [],
          flairs_status: null,
          post_to_profile: true
        },
        tiktok: {
          privacy_level: { "account-0": "" },
          allow_comments: { "account-0": false },
          allow_duet: { "account-0": false },
          allow_stitch: { "account-0": false },
          content_disclosure: { "account-0": false },
          brand_organic_toggle: { "account-0": false },
          brand_content_toggle: { "account-0": false }
        },
        tumblr: {
          tumblr_image_post_type: 0,
          tumblr_video_post_type: 0,
          tumblr_text_post_type: 1,
          tumblr_link_post_type: 0,
          tumblr_quote_post_type: 0,
          tumblr_chat_post_type: 0,
          tumblr_post_type: "text",
          tumblr_post_title: "",
          tumblr_post_chat_title: "",
          tumblr_post_link: "",
          tumblr_post: null
        },
        google_m_b: {
          image_post_type: 0,
          video_post_type: 0,
          text_post_type: 0,
          all_post_type: 1,
          topic_type: "none",
          event_title: null,
          start_date: null,
          start_time: null,
          end_date: null,
          end_time: null,
          selected_button_type: "NONE",
          redirect_url: null,
          couponCode: null,
          redeemOnlineUrl: null,
          termsConditions: null,
          selected_media_category: "CATEGORY_UNSPECIFIED",
          gmb_post: null
        }
      }
    }],
    tags: [],
    date: date,
    time: time,
    until_date: null,
    until_time: "",
    repeat_frequency: null,
    short_link_provider: null,
    short_link_provider_id: null
  };
  
  const response = await fetch(`${BASE_URL}/posts`, {
    method: 'POST',
    headers: getCleanHeaders(),
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OnlySocial create post failed: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json() as CreatePostResult;
  console.log(`✅ [OnlySocial] Post created - UUID: ${result.uuid}`);
  
  return result;
}

/**
 * Schedula post su OnlySocial
 * @param postUuid - UUID del post da schedulare
 * @param postNow - Se true, pubblica immediatamente (per recupero post scaduti)
 */
async function _scheduleOnlySocialPost({ 
  postUuid,
  postNow = false
}: { 
  postUuid: string;
  postNow?: boolean;
}): Promise<SchedulePostResult> {
  console.log(`⏰ [OnlySocial] ${postNow ? 'Publishing NOW' : 'Scheduling'} post: ${postUuid}`);
  
  const response = await fetch(`${BASE_URL}/posts/schedule/${postUuid}`, {
    method: 'POST',
    headers: getCleanHeaders(),
    body: JSON.stringify({
      postNow: postNow
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OnlySocial schedule post failed: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json() as SchedulePostResult;
  console.log(`✅ [OnlySocial] Post ${postNow ? 'published' : 'scheduled'}: ${result.scheduled_at}`);
  
  return result;
}

/**
 * Fetch lista account da OnlySocial (per verifica stato)
 */
async function _fetchOnlySocialAccounts(): Promise<OnlySocialAccount[]> {
  console.log(`📡 [OnlySocial] Fetching accounts list...`);
  
  const response = await fetch(`${BASE_URL}/accounts`, {
    method: 'GET',
    headers: getCleanHeaders()
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OnlySocial fetch accounts failed: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json() as { data: OnlySocialAccount[] };
  console.log(`✅ [OnlySocial] Received ${data.data?.length || 0} accounts`);
  
  return data.data || [];
}

// Export funzioni wrapped con rate limiter
export const uploadVideoToOnlySocial = onlySocialLimiter.wrap(_uploadVideoToOnlySocial);
export const createOnlySocialPost = onlySocialLimiter.wrap(_createOnlySocialPost);
export const scheduleOnlySocialPost = onlySocialLimiter.wrap(_scheduleOnlySocialPost);
export const fetchOnlySocialAccounts = onlySocialLimiter.wrap(_fetchOnlySocialAccounts);
