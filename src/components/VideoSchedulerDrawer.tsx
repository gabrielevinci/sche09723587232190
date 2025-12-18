'use client'

/**
 * VideoSchedulerDrawer Component - NEW VERSION
 * 
 * Workflow:
 * 1. L'utente clicca "Carica + Schedula" → appare subito il drawer
 * 2. L'utente seleziona uno o più account (della stessa piattaforma) dalla parte superiore
 * 3. L'utente aggiunge righe di post (ogni riga = un post schedulato)
 * 4. Per ogni riga può caricare un contenuto (opzionale per Telegram, obbligatorio per Instagram)
 * 5. Al click su "Schedula Tutti" i video vengono caricati su DigitalOcean e salvati nel DB
 * 
 * IMPORTANTE: Tutti gli orari sono gestiti in formato italiano (Europe/Rome)
 */

import { useEffect, useState, useRef, useCallback } from 'react'

// Interfacce
export interface SocialAccount {
  id: string
  platform: string
  accountName: string
  accountId: string
  accountUuid?: string | null
  isActive: boolean
}

export interface PostRow {
  id: string
  caption: string
  year: number
  month: number
  day: number
  hour: number
  minute: number
  postType: 'reel' | 'story' | 'post'
  file: File | null
  filePreviewUrl: string | null
}

export interface ScheduleData {
  accounts: SocialAccount[]
  posts: PostRow[]
}

interface VideoSchedulerDrawerProps {
  isOpen: boolean
  onClose: () => void
  accounts: SocialAccount[]
  onSchedule: (data: ScheduleData) => Promise<void>
}

export default function VideoSchedulerDrawer({ 
  isOpen, 
  onClose, 
  accounts, 
  onSchedule 
}: VideoSchedulerDrawerProps) {
  // Stato account selezionati
  const [selectedAccounts, setSelectedAccounts] = useState<SocialAccount[]>([])
  
  // Stato righe post
  const [posts, setPosts] = useState<PostRow[]>([])
  
  // Loading state
  const [loading, setLoading] = useState(false)
  
  // Preview video/immagine
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  
  // Ref per input file nascosti
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

  // Crea data/ora di default (ora corrente)
  const getDefaultDateTime = useCallback(() => {
    const now = new Date()
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes()
    }
  }, [])

  // Aggiungi nuova riga post
  const addNewPost = useCallback(() => {
    const defaultDate = getDefaultDateTime()
    const newPost: PostRow = {
      id: `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      caption: '',
      ...defaultDate,
      postType: 'reel',
      file: null,
      filePreviewUrl: null
    }
    setPosts(prev => [...prev, newPost])
  }, [getDefaultDateTime])

  // Inizializza con una riga vuota quando si apre
  useEffect(() => {
    if (isOpen && posts.length === 0) {
      addNewPost()
    }
  }, [isOpen, posts.length, addNewPost])

  // Cleanup preview URLs quando il componente si smonta
  useEffect(() => {
    return () => {
      posts.forEach(post => {
        if (post.filePreviewUrl) {
          URL.revokeObjectURL(post.filePreviewUrl)
        }
      })
    }
  }, [posts])

  // Piattaforma degli account selezionati (tutti devono essere uguali)
  const selectedPlatform = selectedAccounts.length > 0 ? selectedAccounts[0].platform : null

  // Toggle selezione account
  const toggleAccountSelection = (account: SocialAccount) => {
    setSelectedAccounts(prev => {
      const isSelected = prev.some(a => a.id === account.id)
      if (isSelected) {
        // Rimuovi account
        return prev.filter(a => a.id !== account.id)
      } else {
        // Aggiungi account (solo se stessa piattaforma o primo account)
        if (prev.length === 0 || prev[0].platform === account.platform) {
          return [...prev, account]
        }
        return prev
      }
    })
  }

  // Rimuovi riga post
  const removePost = (postId: string) => {
    setPosts(prev => {
      const post = prev.find(p => p.id === postId)
      if (post?.filePreviewUrl) {
        URL.revokeObjectURL(post.filePreviewUrl)
      }
      return prev.filter(p => p.id !== postId)
    })
  }

  // Aggiorna campo di una riga
  const updatePost = (postId: string, field: keyof PostRow, value: PostRow[keyof PostRow]) => {
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        return { ...post, [field]: value }
      }
      return post
    }))
  }

  // Gestisci selezione file
  const handleFileSelect = (postId: string, file: File | null) => {
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        // Revoke old preview URL
        if (post.filePreviewUrl) {
          URL.revokeObjectURL(post.filePreviewUrl)
        }
        // Create new preview URL
        const previewUrl = file ? URL.createObjectURL(file) : null
        return { ...post, file, filePreviewUrl: previewUrl }
      }
      return post
    }))
  }

  // Trigger file input click
  const triggerFileInput = (postId: string) => {
    fileInputRefs.current[postId]?.click()
  }

  // Validazione
  const validateData = (): string[] => {
    const errors: string[] = []

    if (selectedAccounts.length === 0) {
      errors.push('Seleziona almeno un account')
    }

    if (posts.length === 0) {
      errors.push('Aggiungi almeno un post')
    }

    const isInstagram = selectedPlatform?.toLowerCase() === 'instagram'
    const isTelegram = selectedPlatform?.toLowerCase() === 'telegram'

    posts.forEach((post, index) => {
      const rowNum = index + 1

      // Per Instagram: contenuto obbligatorio
      if (isInstagram && !post.file) {
        errors.push(`Riga ${rowNum}: Instagram richiede un contenuto (video/foto)`)
      }

      // Per Telegram: almeno uno tra contenuto o didascalia
      if (isTelegram && !post.file && !post.caption.trim()) {
        errors.push(`Riga ${rowNum}: Inserire almeno un contenuto o una didascalia`)
      }

      // Validazione data
      if (!isValidDate(post.year, post.month, post.day, post.hour, post.minute)) {
        errors.push(`Riga ${rowNum}: Data non valida`)
      }

      // Validazione futuro (almeno 1 ora)
      if (!isAtLeastOneHourInFuture(post.year, post.month, post.day, post.hour, post.minute)) {
        errors.push(`Riga ${rowNum}: La data deve essere almeno 1 ora nel futuro`)
      }

      // Tipologia obbligatoria per Instagram
      if (isInstagram && !post.postType) {
        errors.push(`Riga ${rowNum}: Seleziona una tipologia (reel, story, post)`)
      }
    })

    return errors
  }

  const isValidDate = (year: number, month: number, day: number, hour: number, minute: number): boolean => {
    if (month < 1 || month > 12) return false
    if (day < 1 || day > 31) return false
    if (hour < 0 || hour > 23) return false
    if (minute < 0 || minute > 59) return false
    const date = new Date(year, month - 1, day, hour, minute)
    return date.getFullYear() === year &&
           date.getMonth() === month - 1 &&
           date.getDate() === day
  }

  const isAtLeastOneHourInFuture = (year: number, month: number, day: number, hour: number, minute: number): boolean => {
    const scheduledDate = new Date(year, month - 1, day, hour, minute)
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000)
    return scheduledDate > oneHourFromNow
  }

  // Submit
  const handleSubmit = async () => {
    const errors = validateData()
    if (errors.length > 0) {
      alert('Errori di validazione:\n\n' + errors.join('\n'))
      return
    }

    setLoading(true)
    try {
      await onSchedule({
        accounts: selectedAccounts,
        posts: posts
      })
      // Reset e chiudi
      setSelectedAccounts([])
      setPosts([])
      onClose()
    } catch (error) {
      console.error('Errore durante la schedulazione:', error)
      alert('Errore: ' + (error instanceof Error ? error.message : 'Errore sconosciuto'))
    } finally {
      setLoading(false)
    }
  }

  // Chiudi drawer
  const handleClose = () => {
    if (loading) return
    // Cleanup
    posts.forEach(post => {
      if (post.filePreviewUrl) {
        URL.revokeObjectURL(post.filePreviewUrl)
      }
    })
    setSelectedAccounts([])
    setPosts([])
    setPreviewUrl(null)
    onClose()
  }

  // Icona piattaforma
  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        )
      case 'telegram':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
        )
    }
  }

  // Colore piattaforma
  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram':
        return 'bg-gradient-to-r from-purple-500 to-pink-500'
      case 'telegram':
        return 'bg-blue-500'
      default:
        return 'bg-gray-500'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[95vw] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Schedula Video</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Account Selection */}
        <div className="p-4 border-b bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Seleziona Account</h3>
          <div className="flex flex-wrap gap-2">
            {accounts.map(account => {
              const isSelected = selectedAccounts.some(a => a.id === account.id)
              const isDisabled = selectedPlatform !== null && account.platform !== selectedPlatform && !isSelected
              
              return (
                <button
                  key={account.id}
                  onClick={() => !isDisabled && toggleAccountSelection(account)}
                  disabled={isDisabled || !account.isActive}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all
                    ${isSelected 
                      ? `${getPlatformColor(account.platform)} text-white border-transparent` 
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }
                    ${isDisabled || !account.isActive ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  <span className={isSelected ? 'text-white' : getPlatformColor(account.platform).replace('bg-', 'text-').replace('-500', '-600')}>
                    {getPlatformIcon(account.platform)}
                  </span>
                  <span className="font-medium">{account.accountName}</span>
                  {isSelected && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
          {selectedPlatform && (
            <p className="text-xs text-gray-500 mt-2">
              Piattaforma selezionata: <strong className="capitalize">{selectedPlatform}</strong>
              {selectedPlatform.toLowerCase() === 'telegram' && (
                <span className="ml-2 text-blue-600">• Il contenuto è opzionale per Telegram</span>
              )}
            </p>
          )}
        </div>

        {/* Posts Table */}
        <div className="flex-1 overflow-auto p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left text-sm font-medium text-gray-700 w-8">#</th>
                  <th className="border p-2 text-left text-sm font-medium text-gray-700 min-w-[200px]">Didascalia</th>
                  <th className="border p-2 text-left text-sm font-medium text-gray-700 w-20">Anno</th>
                  <th className="border p-2 text-left text-sm font-medium text-gray-700 w-16">Mese</th>
                  <th className="border p-2 text-left text-sm font-medium text-gray-700 w-20">Giorno</th>
                  <th className="border p-2 text-left text-sm font-medium text-gray-700 w-16">Ora</th>
                  <th className="border p-2 text-left text-sm font-medium text-gray-700 w-20">Minuti</th>
                  <th className="border p-2 text-left text-sm font-medium text-gray-700 w-28">Tipologia</th>
                  <th className="border p-2 text-left text-sm font-medium text-gray-700 w-40">Contenuto</th>
                  <th className="border p-2 text-left text-sm font-medium text-gray-700 w-16">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post, index) => (
                  <tr key={post.id} className="hover:bg-gray-50">
                    <td className="border p-2 text-center text-gray-500">{index + 1}</td>
                    <td className="border p-1">
                      <textarea
                        value={post.caption}
                        onChange={(e) => updatePost(post.id, 'caption', e.target.value)}
                        className="w-full p-2 border rounded text-sm resize-none"
                        rows={2}
                        placeholder="Inserisci didascalia..."
                      />
                    </td>
                    <td className="border p-1">
                      <input
                        type="number"
                        value={post.year}
                        onChange={(e) => updatePost(post.id, 'year', parseInt(e.target.value) || 0)}
                        className="w-full p-2 border rounded text-sm text-center"
                        min={2024}
                        max={2030}
                      />
                    </td>
                    <td className="border p-1">
                      <input
                        type="number"
                        value={post.month}
                        onChange={(e) => updatePost(post.id, 'month', parseInt(e.target.value) || 0)}
                        className="w-full p-2 border rounded text-sm text-center"
                        min={1}
                        max={12}
                      />
                    </td>
                    <td className="border p-1">
                      <input
                        type="number"
                        value={post.day}
                        onChange={(e) => updatePost(post.id, 'day', parseInt(e.target.value) || 0)}
                        className="w-full p-2 border rounded text-sm text-center"
                        min={1}
                        max={31}
                      />
                    </td>
                    <td className="border p-1">
                      <input
                        type="number"
                        value={post.hour}
                        onChange={(e) => updatePost(post.id, 'hour', parseInt(e.target.value) || 0)}
                        className="w-full p-2 border rounded text-sm text-center"
                        min={0}
                        max={23}
                      />
                    </td>
                    <td className="border p-1">
                      <input
                        type="number"
                        value={post.minute}
                        onChange={(e) => updatePost(post.id, 'minute', parseInt(e.target.value) || 0)}
                        className="w-full p-2 border rounded text-sm text-center"
                        min={0}
                        max={59}
                      />
                    </td>
                    <td className="border p-1">
                      <select
                        value={post.postType}
                        onChange={(e) => updatePost(post.id, 'postType', e.target.value as 'reel' | 'story' | 'post')}
                        className="w-full p-2 border rounded text-sm"
                      >
                        <option value="reel">Reel</option>
                        <option value="story">Story</option>
                        <option value="post">Post</option>
                      </select>
                    </td>
                    <td className="border p-2">
                      <div className="flex items-center gap-2">
                        {/* Hidden file input */}
                        <input
                          type="file"
                          ref={(el) => { fileInputRefs.current[post.id] = el }}
                          onChange={(e) => handleFileSelect(post.id, e.target.files?.[0] || null)}
                          accept="video/*,image/*"
                          className="hidden"
                        />
                        
                        {post.file ? (
                          <>
                            <button
                              onClick={() => setPreviewUrl(post.filePreviewUrl)}
                              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                              👁️ Vedi
                            </button>
                            <button
                              onClick={() => handleFileSelect(post.id, null)}
                              className="px-2 py-1 text-sm bg-red-100 text-red-600 rounded hover:bg-red-200"
                              title="Rimuovi file"
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => triggerFileInput(post.id)}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 border border-gray-300"
                          >
                            📁 Carica
                          </button>
                        )}
                      </div>
                      {post.file && (
                        <p className="text-xs text-gray-500 mt-1 truncate max-w-[150px]" title={post.file.name}>
                          {post.file.name}
                        </p>
                      )}
                    </td>
                    <td className="border p-2 text-center">
                      {posts.length > 1 && (
                        <button
                          onClick={() => removePost(post.id)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                          title="Rimuovi riga"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Preview Modal */}
        {previewUrl && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
            <div className="bg-white rounded-lg max-w-3xl max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="font-semibold">Anteprima</h3>
                <button onClick={() => setPreviewUrl(null)} className="text-gray-500 hover:text-gray-700">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                {previewUrl.includes('video') || previewUrl.includes('.mp4') || previewUrl.includes('.mov') ? (
                  <video src={previewUrl} controls className="max-w-full max-h-[60vh]">
                    Il tuo browser non supporta il tag video.
                  </video>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Preview" className="max-w-full max-h-[60vh] object-contain" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              disabled={loading}
              className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Annulla
            </button>
            <button
              onClick={addNewPost}
              disabled={loading}
              className="px-4 py-2 text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Aggiungi Post
            </button>
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading || selectedAccounts.length === 0 || posts.length === 0}
            className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Schedulazione in corso...
              </>
            ) : (
              'Schedula Tutti'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
