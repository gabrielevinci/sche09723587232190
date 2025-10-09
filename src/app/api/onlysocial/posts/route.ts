import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { OnlySocialAPI } from '@/lib/onlysocial-api'

export async function GET(request: NextRequest) {
  try {
    // Verifica autenticazione
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')

    const token = process.env.ONLYSOCIAL_API_KEY
    const workspaceUuid = process.env.ONLYSOCIAL_WORKSPACE_UUID

    if (!token || !workspaceUuid) {
      return NextResponse.json(
        { error: 'Configurazione OnlySocial mancante' },
        { status: 500 }
      )
    }

    const api = new OnlySocialAPI({ token, workspaceUuid })
    const posts = await api.listPosts(page)

    return NextResponse.json(posts)
  } catch (error) {
    console.error('Error fetching OnlySocial posts:', error)
    return NextResponse.json(
      { error: 'Errore nel recupero dei post' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verifica autenticazione
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      content, 
      accountUuid, 
      mediaUrls = [], 
      mediaIds = [],
      digitalOceanUrls = [],
      scheduleDate, 
      scheduleTime, 
      postType 
    } = body

    // Validazione: almeno content e accountUuid
    if (!content || !accountUuid) {
      return NextResponse.json(
        { error: 'Contenuto e accountUuid sono obbligatori' },
        { status: 400 }
      )
    }

    const token = process.env.ONLYSOCIAL_API_KEY
    const workspaceUuid = process.env.ONLYSOCIAL_WORKSPACE_UUID

    if (!token || !workspaceUuid) {
      return NextResponse.json(
        { error: 'Configurazione OnlySocial mancante' },
        { status: 500 }
      )
    }

    const api = new OnlySocialAPI({ token, workspaceUuid })

    console.log('📝 Creating post on OnlySocial...')
    console.log(`   Account UUID: ${accountUuid}`)
    console.log(`   Caption: ${content.substring(0, 50)}...`)
    console.log(`   Media URLs: ${mediaUrls.length}`)
    console.log(`   Media IDs: ${mediaIds.length}`)
    console.log(`   DigitalOcean URLs: ${digitalOceanUrls.length}`)

    let finalMediaIds: number[] = []

    // OPZIONE 1: Se sono forniti media IDs (già caricati), usali direttamente
    if (mediaIds && mediaIds.length > 0) {
      console.log('✅ Using pre-uploaded media IDs')
      finalMediaIds = mediaIds
    }
    // OPZIONE 2: Se sono forniti DigitalOcean URLs, caricali prima
    else if (digitalOceanUrls && digitalOceanUrls.length > 0) {
      console.log('📤 Uploading videos from DigitalOcean...')
      
      for (const url of digitalOceanUrls) {
        try {
          // Estrai il nome del file dall'URL
          const fileName = url.split('/').pop() || 'video.mp4'
          
          console.log(`   Uploading: ${fileName}`)
          const uploadResult = await api.uploadMediaFromDigitalOcean(
            url,
            fileName,
            `Video uploaded on ${new Date().toLocaleDateString()}`
          )
          
          finalMediaIds.push(uploadResult.id)
          console.log(`   ✓ Uploaded with ID: ${uploadResult.id}`)
        } catch (error) {
          console.error(`   ✗ Failed to upload ${url}:`, error)
          throw error
        }
      }
      
      console.log(`✅ All videos uploaded. Media IDs: ${finalMediaIds.join(', ')}`)
    }
    // OPZIONE 3: Se sono forniti media URLs (metodo vecchio), usa quello
    else if (mediaUrls && mediaUrls.length > 0) {
      console.log('⚠️ Using legacy media URL upload method')
      const result = await api.createMediaPost(
        accountUuid,
        content,
        mediaUrls,
        scheduleDate,
        scheduleTime,
        postType
      )
      return NextResponse.json(result, { status: 201 })
    }

    // Crea il post con i media IDs
    if (finalMediaIds.length > 0) {
      console.log('📤 Creating post with media IDs...')
      const result = await api.createPostWithMediaIds(
        accountUuid,
        content,
        finalMediaIds,
        postType
      )
      
      console.log('✅ Post created successfully!')
      return NextResponse.json(result, { status: 201 })
    } else {
      // Nessun media, crea post solo testo (se supportato)
      console.log('📝 Creating text-only post...')
      const result = await api.createPostWithMediaIds(
        accountUuid,
        content,
        [],
        postType
      )
      return NextResponse.json(result, { status: 201 })
    }

  } catch (error) {
    console.error('❌ Error creating OnlySocial post:', error)
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto'
    return NextResponse.json(
      { error: `Errore nella creazione del post: ${errorMessage}` },
      { status: 500 }
    )
  }
}
