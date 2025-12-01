'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import VideoSchedulerDrawer, { VideoFile, ScheduleRow } from '@/components/VideoSchedulerDrawer'

interface SocialProfile {
  id: string
  platform: string
  accountName: string
  accountId: string
  accountUuid?: string | null
  isActive: boolean
  assignedAt: string
  createdAt: string
}

interface UserProfilesData {
  user: {
    id: string
    name: string
    email: string
    isActive: boolean
  }
  socialProfiles: SocialProfile[]
  totalProfiles: number
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [profilesData, setProfilesData] = useState<UserProfilesData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Stati per il modal di selezione profilo
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<SocialProfile | null>(null)
  
  // Stati per il drawer di scheduling
  const [videosToSchedule, setVideosToSchedule] = useState<VideoFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      loadUserProfiles()
    }
  }, [status, router])

  const loadUserProfiles = async () => {
    try {
      console.log('🔄 [Dashboard] Caricamento profili utente...')
      setIsLoading(true)
      const res = await fetch('/api/user/profiles')
      console.log('📡 [Dashboard] Risposta API ricevuta:', res.status, res.ok)
      
      if (res.ok) {
        const data = await res.json()
        console.log('✅ [Dashboard] Dati profili caricati:', data)
        console.log('   → User:', data.user)
        console.log('   → Total Profiles:', data.totalProfiles)
        console.log('   → Social Profiles:', data.socialProfiles)
        setProfilesData(data)
      } else {
        const errorText = await res.text()
        console.error('❌ [Dashboard] Errore caricamento profili:', errorText)
      }
    } catch (error) {
      console.error('❌ [Dashboard] Errore caricamento profili:', error)
    } finally {
      setIsLoading(false)
      console.log('✅ [Dashboard] Caricamento profili completato')
    }
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
  }

  // Gestione apertura modal selezione profilo
  const handleUploadScheduleClick = () => {
    console.log('🔘 [Dashboard] Click su "Carica + Schedula"')
    console.log('   → isLoading:', isLoading)
    console.log('   → profilesData:', profilesData)
    console.log('   → hasProfiles:', hasProfiles)
    console.log('   → showProfileModal (before):', showProfileModal)
    
    // Se ancora in caricamento, aspetta
    if (isLoading) {
      console.warn('⏳ [Dashboard] Caricamento in corso, attendere...')
      alert('Caricamento in corso, attendere...')
      return
    }
    
    // Se non ha profili, mostra alert
    if (!hasProfiles) {
      console.warn('❌ [Dashboard] Nessun profilo assegnato')
      console.log('   → profilesData?.socialProfiles:', profilesData?.socialProfiles)
      console.log('   → length:', profilesData?.socialProfiles?.length)
      alert('Non hai profili social assegnati. Contatta l\'amministratore.')
      return
    }
    
    console.log('✅ [Dashboard] Apertura modal con profili:', profilesData?.socialProfiles)
    setShowProfileModal(true)
    console.log('   → showProfileModal (after):', true)
  }

  // Gestione selezione profilo e apertura file picker
  const handleProfileSelect = (profile: SocialProfile) => {
    console.log('👤 [Dashboard] Profilo selezionato:', profile)
    setSelectedProfile(profile)
    setShowProfileModal(false)
    console.log('   → Chiusura modal')
    
    // Trigger file input click
    setTimeout(() => {
      console.log('📁 [Dashboard] Apertura file picker...')
      fileInputRef.current?.click()
    }, 100)
  }

  // Gestione selezione file video
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    if (!selectedProfile) return

    try {
      setIsUploading(true)

      const videoFiles: VideoFile[] = []
      
      // Converti FileList in array e ordina alfabeticamente
      const filesArray = Array.from(files).sort((a, b) => a.name.localeCompare(b.name))
      
      // Crea un timestamp unico per questo batch di upload
      const batchTimestamp = new Date().toISOString().replace(/[:.]/g, '-')
      
      console.log(`📤 [Dashboard] Iniziando upload di ${filesArray.length} video...`)
      console.log(`📦 [Dashboard] Batch timestamp: ${batchTimestamp}`)

      // Upload ogni file direttamente a DigitalOcean usando presigned URLs
      for (let i = 0; i < filesArray.length; i++) {
        const file = filesArray[i]
        console.log(`📤 [Dashboard] Upload ${i + 1}/${filesArray.length}: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`)

        try {
          // 1. Ottieni presigned URL (passa lo stesso timestamp per tutti i file)
          const presignedRes = await fetch('/api/upload/presigned-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profileId: selectedProfile.id,
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type || 'video/mp4',
              timestamp: batchTimestamp, // Stesso timestamp per tutti i file del batch
            }),
          })

          if (!presignedRes.ok) {
            const error = await presignedRes.json()
            throw new Error(error.error || 'Errore generazione URL')
          }

          const { presignedUrl, publicUrl } = await presignedRes.json()

          // 2. Upload diretto a DigitalOcean
          const uploadRes = await fetch(presignedUrl, {
            method: 'PUT',
            body: file,
            headers: {
              'Content-Type': file.type || 'video/mp4',
            },
          })

          if (!uploadRes.ok) {
            throw new Error(`Upload fallito: ${uploadRes.status} ${uploadRes.statusText}`)
          }

          console.log(`✅ [Dashboard] Upload completato: ${file.name}`)

          // Aggiungi alla lista dei video
          videoFiles.push({
            id: `video-${i}`,
            name: file.name,
            url: publicUrl,
          })

        } catch (error) {
          console.error(`❌ [Dashboard] Errore upload ${file.name}:`, error)
          throw new Error(`Errore upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown'}`)
        }
      }

      console.log(`✅ [Dashboard] Tutti i ${filesArray.length} video caricati con successo!`)

      // Apri il drawer con i video caricati
      setVideosToSchedule(videoFiles)

    } catch (error) {
      console.error('Errore durante l\'upload:', error)
      alert('Errore durante l\'upload dei video: ' + (error instanceof Error ? error.message : 'Errore sconosciuto'))
    } finally {
      setIsUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Gestione scheduling dei post
  const handleSchedulePosts = async (rows: ScheduleRow[]) => {
    if (!selectedProfile) {
      throw new Error('Nessun profilo selezionato')
    }

    // Timezone italiano fisso (Europe/Rome = UTC+1)
    const userTimezone = 'Europe/Rome'

    // Prepara i dati per l'API di salvataggio
    const videos = rows.map(row => {
      const video = videosToSchedule.find(v => v.id === row.videoId)
      
      // Crea data nel timezone italiano (NO conversione UTC, salviamo direttamente l'orario italiano)
      const scheduledDateIT = new Date(row.year, row.month - 1, row.day, row.hour, row.minute)
      
      console.log(`📅 Scheduling video: ${video?.name}`)
      console.log(`   Orario italiano: ${row.year}-${row.month}-${row.day} ${row.hour}:${row.minute}`)
      console.log(`   Salvato come: ${scheduledDateIT.toISOString()}`)
      
      return {
        socialAccountId: selectedProfile.id,
        videoUrl: video?.url || '',
        videoFilename: video?.name || 'video.mp4',
        videoSize: 0,
        caption: row.caption,
        postType: row.postType || 'post',
        // SALVA DIRETTAMENTE LA DATA IN FORMATO ITALIANO (senza conversione UTC)
        scheduledFor: scheduledDateIT.toISOString(),
      }
    })

    // Salva i video nel database
    const response = await fetch('/api/posts/schedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        socialAccountId: selectedProfile.id,
        accountUuid: selectedProfile.accountUuid,
        accountId: selectedProfile.accountId ? parseInt(selectedProfile.accountId, 10) : undefined,
        caption: videos[0].caption,
        postType: videos[0].postType,
        videoUrls: videos.map(v => v.videoUrl),
        videoFilenames: videos.map(v => v.videoFilename),
        videoSizes: videos.map(v => v.videoSize),
        scheduledFor: videos[0].scheduledFor,
        timezone: userTimezone,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Errore durante il salvataggio')
    }

    const result = await response.json()
    console.log('📊 Video salvati nel database:', result)
    
    // Mostra un messaggio informativo all'utente
    alert(`✅ Video salvati con successo nel database!\n\nProgrammati per: ${new Date(videos[0].scheduledFor).toLocaleString('it-IT')}`)

    // Chiudi il drawer
    setVideosToSchedule([])
    setSelectedProfile(null)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Caricamento...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  // Check if user has access (social accounts assigned)
  // Mostra il contenuto solo se i dati sono caricati
  const hasAccess = profilesData?.user?.isActive ?? false
  const hasProfiles = profilesData?.socialProfiles && profilesData.socialProfiles.length > 0
  
  // Debug: Log stato componente
  console.log('🔍 [Dashboard] Render state:', {
    isLoading,
    hasAccess,
    hasProfiles,
    profilesDataExists: !!profilesData,
    profilesCount: profilesData?.socialProfiles?.length || 0,
    showProfileModal,
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Dashboard - Social Media Scheduler
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Ciao, {session.user.name}
              </span>
              <button
                onClick={handleSignOut}
                className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Esci
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {isLoading ? (
            // Mostra loading durante il caricamento iniziale
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Caricamento dati...</span>
            </div>
          ) : !hasAccess ? (
            // User without access
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Account in attesa di attivazione
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      Il tuo account è stato creato con successo, ma è ancora in attesa di attivazione. 
                      Un amministratore deve assegnarti gli account social prima che tu possa accedere alle funzionalità della piattaforma.
                    </p>
                    <p className="mt-2">
                      Ti preghiamo di contattare l&apos;amministratore per completare l&apos;attivazione del tuo account.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Active user dashboard
            <div className="space-y-6">
              {/* I tuoi Profili Social */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-medium text-gray-900">
                      Account Collegati
                    </h2>
                    {!isLoading && profilesData && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {profilesData.totalProfiles} {profilesData.totalProfiles === 1 ? 'profilo' : 'profili'}
                      </span>
                    )}
                  </div>
                  
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-2 text-gray-600">Caricamento profili...</span>
                    </div>
                  ) : profilesData && profilesData.socialProfiles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {profilesData.socialProfiles.map((profile) => (
                        <div
                          key={profile.id}
                          className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                  <span className="text-blue-600 font-semibold text-sm">
                                    {profile.platform.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <h3 className="font-semibold text-gray-900 text-sm">
                                    {profile.accountName}
                                  </h3>
                                  <p className="text-xs text-gray-500 capitalize">
                                    {profile.platform.replace('_', ' ')}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="space-y-1 text-xs text-gray-600">
                                <p>
                                  <span className="font-medium">ID:</span> {profile.accountId}
                                </p>
                                <p>
                                  <span className="font-medium">Assegnato il:</span>{' '}
                                  {new Date(profile.assignedAt).toLocaleDateString('it-IT')}
                                </p>
                                <p>
                                  <span className="font-medium">Stato:</span>{' '}
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    profile.isActive 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {profile.isActive ? 'Attivo' : 'Inattivo'}
                                  </span>
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>Nessun profilo social assegnato</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Gestione Contenuti */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-6">
                    Gestione Contenuti
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={handleUploadScheduleClick}
                      disabled={isUploading}
                      className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 text-center hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {isUploading ? 'Caricamento...' : 'Carica + Schedula'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Carica contenuti e programmali per la pubblicazione
                      </p>
                    </button>

                    <button
                      disabled
                      className="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Carica</h3>
                      <p className="text-sm text-gray-600">
                        Gestisci l&apos;upload dei tuoi contenuti multimediali
                      </p>
                      <span className="inline-block mt-2 px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded">
                        Prossimamente
                      </span>
                    </button>

                    <button
                      disabled
                      className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6 text-center hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Schedula</h3>
                      <p className="text-sm text-gray-600">
                        Programma i tuoi post per massimizzare l&apos;engagement
                      </p>
                      <span className="inline-block mt-2 px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded">
                        Prossimamente
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats Overview */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-6">
                    Statistiche
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-gray-900">0</div>
                      <div className="text-sm text-gray-600">Post Programmati</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-gray-900">0</div>
                      <div className="text-sm text-gray-600">Post Pubblicati</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-gray-900">0</div>
                      <div className="text-sm text-gray-600">Media Caricati</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-gray-900">0</div>
                      <div className="text-sm text-gray-600">Account Collegati</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Hidden file input per selezione video */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Modal selezione profilo */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity backdrop-blur-sm bg-black/30"
              onClick={() => {
                console.log('🔘 [Dashboard] Click overlay - chiusura modal')
                setShowProfileModal(false)
              }}
            />

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6 relative z-10">
              <div>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Seleziona un Profilo
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Scegli il profilo social su cui vuoi schedulare i video
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {(() => {
                  console.log('🎨 [Dashboard] Rendering profili nel modal:', profilesData?.socialProfiles?.length)
                  return null
                })()}
                {profilesData?.socialProfiles && profilesData.socialProfiles.length > 0 ? (
                  profilesData.socialProfiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => handleProfileSelect(profile)}
                      className="w-full flex items-center p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-sm">
                          {profile.platform.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-3 flex-1">
                        <h4 className="font-medium text-gray-900">{profile.accountName}</h4>
                        <p className="text-xs text-gray-500 capitalize">{profile.platform.replace('_', ' ')}</p>
                      </div>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <p>⚠️ DEBUG: Nessun profilo trovato</p>
                    <p className="text-xs mt-2">profilesData: {JSON.stringify(profilesData?.socialProfiles)}</p>
                  </div>
                )}
              </div>

              <div className="mt-5 sm:mt-6">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:text-sm"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drawer scheduling video */}
      <VideoSchedulerDrawer
        videos={videosToSchedule}
        onSchedule={handleSchedulePosts}
      />
    </div>
  )
}
