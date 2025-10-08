'use client'

import { useState, useEffect } from 'react'

export interface VideoFile {
  id: string
  name: string
  file: File
  url?: string
  thumbnailUrl?: string
}

export interface ScheduleRow {
  id: string
  videoId: string
  videoName: string
  caption: string
  year: number
  month: number
  day: number
  hour: number
  minute: number
  postType: 'reel' | 'story' | 'post' | ''
  preview: string
}

interface VideoSchedulerDrawerProps {
  isOpen: boolean
  onClose: () => void
  videos: VideoFile[]
  selectedProfile: {
    id: string
    accountName: string
    platform: string
  } | null
  onSchedule: (rows: ScheduleRow[]) => Promise<void>
}

// Funzione di validazione data
function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > 2100) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  const daysInMonth = new Date(year, month, 0).getDate()
  return day <= daysInMonth
}

export default function VideoSchedulerDrawer({
  isOpen,
  onClose,
  videos,
  selectedProfile,
  onSchedule,
}: VideoSchedulerDrawerProps) {
  const currentYear = new Date().getFullYear()
  const [rows, setRows] = useState<ScheduleRow[]>([])
  const [isScheduling, setIsScheduling] = useState(false)

  // Aggiorna le righe quando i video cambiano
  useEffect(() => {
    console.log('📹 [VideoSchedulerDrawer] Video cambiati:', videos.length)
    if (videos.length > 0) {
      const newRows = [...videos]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((video, index) => ({
          id: `row-${index}`,
          videoId: video.id,
          videoName: video.name,
          caption: '',
          year: currentYear,
          month: 1,
          day: 1,
          hour: 12,
          minute: 0,
          postType: '' as const,
          preview: video.url || '',
        }))
      console.log('📝 [VideoSchedulerDrawer] Righe create:', newRows.length)
      setRows(newRows)
    }
  }, [videos, currentYear])

  const updateRow = (index: number, field: keyof ScheduleRow, value: string | number) => {
    const newRows = [...rows]
    newRows[index] = { ...newRows[index], [field]: value }
    setRows(newRows)
  }

  const validateAllRows = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = []
    
    rows.forEach((row, index) => {
      if (!row.caption.trim()) {
        errors.push(`Riga ${index + 1}: Didascalia mancante`)
      }
      if (!row.postType) {
        errors.push(`Riga ${index + 1}: Tipologia post mancante`)
      }
      if (!isValidDate(row.year, row.month, row.day)) {
        errors.push(`Riga ${index + 1}: Data non valida ${row.day}/${row.month}/${row.year}`)
      }
      if (row.hour < 0 || row.hour > 23) {
        errors.push(`Riga ${index + 1}: Ora non valida (0-23)`)
      }
      if (row.minute < 0 || row.minute > 59) {
        errors.push(`Riga ${index + 1}: Minuti non validi (0-59)`)
      }
    })
    
    return { valid: errors.length === 0, errors }
  }

  const handleScheduleClick = async () => {
    const validation = validateAllRows()
    
    if (!validation.valid) {
      alert('Errori di validazione:\n\n' + validation.errors.join('\n'))
      return
    }
    
    setIsScheduling(true)
    try {
      await onSchedule(rows)
      alert('Scheduling completato con successo!')
      onClose()
    } catch (error) {
      console.error('Errore durante lo scheduling:', error)
      alert('Errore durante lo scheduling: ' + (error instanceof Error ? error.message : 'Errore sconosciuto'))
    } finally {
      setIsScheduling(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-7xl bg-white shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 bg-blue-600">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Schedula Video - {selectedProfile?.accountName}
            </h2>
            <p className="text-sm text-blue-100 mt-1">
              {rows.length} {rows.length === 1 ? 'video' : 'video'} • {selectedProfile?.platform}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-700 p-2 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Istruzioni */}
      <div className="flex-shrink-0 px-6 py-3 bg-blue-50 border-b border-blue-100">
        <p className="text-sm text-blue-800">
          <strong>Istruzioni:</strong> Compila tutti i campi per ogni video. I campi obbligatori sono: Didascalia, Data completa e Tipologia post.
        </p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="min-w-full">
          <table className="w-full border-collapse">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-700">Video</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-700">Didascalia</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-700">Anno</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-700">Mese</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-700">Giorno</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-700">Ora</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-700">Minuti</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-700">Tipologia</th>
                <th className="border border-gray-300 px-3 py-2 text-left text-sm font-semibold text-gray-700">Preview</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const video = videos.find(v => v.id === row.videoId)
                const dateValid = isValidDate(row.year, row.month, row.day)
                
                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-3 py-2 text-sm text-gray-900 font-medium">
                      {row.videoName}
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      <input
                        type="text"
                        value={row.caption}
                        onChange={(e) => updateRow(index, 'caption', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Scrivi la didascalia..."
                      />
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      <input
                        type="number"
                        value={row.year}
                        onChange={(e) => updateRow(index, 'year', parseInt(e.target.value) || currentYear)}
                        min={2000}
                        max={2100}
                        className={`w-20 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${!dateValid ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      />
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      <input
                        type="number"
                        value={row.month}
                        onChange={(e) => updateRow(index, 'month', parseInt(e.target.value) || 1)}
                        min={1}
                        max={12}
                        className={`w-16 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${!dateValid ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      />
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      <input
                        type="number"
                        value={row.day}
                        onChange={(e) => updateRow(index, 'day', parseInt(e.target.value) || 1)}
                        min={1}
                        max={31}
                        className={`w-16 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${!dateValid ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      />
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      <input
                        type="number"
                        value={row.hour}
                        onChange={(e) => updateRow(index, 'hour', parseInt(e.target.value) || 0)}
                        min={0}
                        max={23}
                        className="w-16 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      <input
                        type="number"
                        value={row.minute}
                        onChange={(e) => updateRow(index, 'minute', parseInt(e.target.value) || 0)}
                        min={0}
                        max={59}
                        className="w-16 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      <select
                        value={row.postType}
                        onChange={(e) => updateRow(index, 'postType', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="">Seleziona...</option>
                        <option value="reel">Reel</option>
                        <option value="story">Story</option>
                        <option value="post">Post</option>
                      </select>
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      {video && (
                        <video
                          src={URL.createObjectURL(video.file)}
                          className="h-12 w-20 object-cover rounded"
                          muted
                          playsInline
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {rows.length} {rows.length === 1 ? 'video da schedulare' : 'video da schedulare'}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              disabled={isScheduling}
            >
              Annulla
            </button>
            <button
              onClick={handleScheduleClick}
              disabled={isScheduling || rows.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isScheduling ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Scheduling...</span>
                </>
              ) : (
                <span>Schedula Tutti</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
