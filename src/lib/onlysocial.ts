/**
 * OnlySocial API Integration
 * Gestisce upload video, creazione e schedulazione post
 */

const ONLYSOCIAL_API_KEY = process.env.ONLYSOCIAL_API_KEY
const ONLYSOCIAL_WORKSPACE_UUID = process.env.ONLYSOCIAL_WORKSPACE_UUID

if (!ONLYSOCIAL_API_KEY || !ONLYSOCIAL_WORKSPACE_UUID) {
  throw new Error('OnlySocial API credentials not configured')
}

const BASE_URL = `https://app.onlysocial.io/os/api/${ONLYSOCIAL_WORKSPACE_UUID}`

interface UploadVideoResult {
  id: string // Restituito come stringa dall'API
  uuid: string
  name: string
  mime_type: string
  type: string
  url: string
  thumb_url: string
  is_video: boolean
  created_at: string
}

interface CreatePostResult {
  id: number
  uuid: string
  name: string
  hex_color: string
}

interface SchedulePostResult {
  success: boolean
  scheduled_at: string
  needs_approval: boolean
}

/**
 * Step 1: Upload video su OnlySocial
 */
export async function uploadVideoToOnlySocial({
  videoUrl,
  filename
}: {
  videoUrl: string
  filename: string
}): Promise<UploadVideoResult> {
  console.log(`📤 Downloading video from: ${videoUrl}`)
  
  // Scarica il video da Digital Ocean
  const videoResponse = await fetch(videoUrl)
  if (!videoResponse.ok) {
    throw new Error(`Failed to download video: ${videoResponse.statusText}`)
  }
  
  const videoBlob = await videoResponse.blob()
  console.log(`✅ Video downloaded: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`)
  
  // Crea FormData per upload
  const formData = new FormData()
  formData.append('file', videoBlob, filename)
  formData.append('alt_text', filename)
  
  console.log(`📤 Uploading to OnlySocial...`)
  
  // Upload a OnlySocial
  const response = await fetch(`${BASE_URL}/media`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ONLYSOCIAL_API_KEY}`,
    },
    body: formData
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`❌ OnlySocial upload failed:`, errorText)
    throw new Error(`OnlySocial upload failed: ${response.status} - ${errorText}`)
  }
  
  const result: UploadVideoResult = await response.json()
  console.log(`✅ Video uploaded to OnlySocial - ID: ${result.id}, URL: ${result.url}`)
  
  return result
}

/**
 * Step 2: Crea post su OnlySocial
 */
export async function createOnlySocialPost({
  accountId,
  mediaId,
  caption,
  postType,
  scheduledFor
}: {
  accountId: number
  mediaId: number // DEVE essere integer
  caption: string
  postType: string
  scheduledFor: Date
}): Promise<CreatePostResult> {
  // Converti scheduledFor in formato richiesto dall'API
  // scheduledFor è già un Date object
  const date = scheduledFor.toISOString().split('T')[0] // "2025-11-27"
  const timeString = scheduledFor.toTimeString().split(' ')[0] // "23:57:00"
  const time = timeString.split(':').slice(0, 2).join(':') // "23:57"
  
  console.log(`📝 Creating post for account ${accountId}`)
  console.log(`   Date: ${date}, Time: ${time}`)
  console.log(`   Media ID: ${mediaId} (type: ${typeof mediaId})`)
  console.log(`   Post Type: ${postType}`)
  
  const payload = {
    accounts: [accountId],
    versions: [{
      account_id: 0,
      is_original: true,
      content: [{
        body: caption,
        media: [mediaId], // Array di integer
        url: ""
      }],
      options: {
        instagram: {
          type: postType === 'story' ? 'story' : postType,
          collaborators: []
        },
        instagram_direct: {
          type: postType === 'story' ? 'story' : postType,
          collaborators: []
        },
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
  }
  
  const response = await fetch(`${BASE_URL}/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ONLYSOCIAL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`❌ OnlySocial create post failed:`, errorText)
    throw new Error(`OnlySocial create post failed: ${response.status} - ${errorText}`)
  }
  
  const result: CreatePostResult = await response.json()
  console.log(`✅ Post created - UUID: ${result.uuid}`)
  
  return result
}

/**
 * Step 3: Schedula post su OnlySocial
 */
export async function scheduleOnlySocialPost({
  postUuid
}: {
  postUuid: string
}): Promise<SchedulePostResult> {
  console.log(`⏰ Scheduling post: ${postUuid}`)
  
  const response = await fetch(`${BASE_URL}/posts/schedule/${postUuid}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ONLYSOCIAL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      postNow: false // false = rispetta data/ora schedulata
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`❌ OnlySocial schedule post failed:`, errorText)
    throw new Error(`OnlySocial schedule post failed: ${response.status} - ${errorText}`)
  }
  
  const result: SchedulePostResult = await response.json()
  console.log(`✅ Post scheduled for: ${result.scheduled_at}`)
  
  return result
}
