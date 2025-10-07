'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface SocialProfile {
  id: string
  platform: string
  accountName: string
  accountId: string
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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      loadUserProfiles()
    }
  }, [status, router])

  const loadUserProfiles = async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/user/profiles')
      if (res.ok) {
        const data = await res.json()
        setProfilesData(data)
      } else {
        console.error('Errore caricamento profili:', await res.text())
      }
    } catch (error) {
      console.error('Errore caricamento profili:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
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
  const hasAccess = profilesData?.user?.isActive ?? false

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
          {!hasAccess ? (
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
                      disabled
                      className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 text-center hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Carica + Schedula</h3>
                      <p className="text-sm text-gray-600">
                        Carica contenuti e programmali per la pubblicazione
                      </p>
                      <span className="inline-block mt-2 px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded">
                        Prossimamente
                      </span>
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
    </div>
  )
}
