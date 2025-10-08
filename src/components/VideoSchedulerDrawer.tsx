'use client'

import { useState, useCallback, useMemo } from 'react'
import { DataGrid } from 'react-data-grid'
import type { Column } from 'react-data-grid'
import 'react-data-grid/lib/styles.css'

export interface VideoFile {
  id: string
  name: string
  file: File
  url?: string // URL del video caricato su DigitalOcean
  thumbnailUrl?: string // URL della thumbnail
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

const POST_TYPES = ['reel', 'story', 'post'] as const

// Funzione di validazione data
function isValidDate(year: number, month: number, day: number): boolean {
  // Controllo valori base
  if (year < 2000 || year > 2100) return false
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false

  // Controllo giorni per mese
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

  // Inizializza le righe con i video ordinati alfabeticamente
  const initialRows: ScheduleRow[] = useMemo(() => {
    return [...videos]
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
  }, [videos, currentYear])

  const [rows, setRows] = useState<ScheduleRow[]>(initialRows)
  const [isScheduling, setIsScheduling] = useState(false)

  // Validazione delle celle
  const validateCell = useCallback((row: ScheduleRow, column: string): string | null => {
    switch (column) {
      case 'year':
        if (row.year < 2000 || row.year > 2100) return 'Anno non valido (2000-2100)'
        break
      case 'month':
        if (row.month < 1 || row.month > 12) return 'Mese non valido (1-12)'
        break
      case 'day':
        if (row.day < 1 || row.day > 31) return 'Giorno non valido (1-31)'
        if (!isValidDate(row.year, row.month, row.day)) {
          return `Data non valida: ${row.day}/${row.month}/${row.year}`
        }
        break
      case 'hour':
        if (row.hour < 0 || row.hour > 23) return 'Ora non valida (0-23)'
        break
      case 'minute':
        if (row.minute < 0 || row.minute > 59) return 'Minuti non validi (0-59)'
        break
      case 'postType':
        if (row.postType && !POST_TYPES.includes(row.postType as typeof POST_TYPES[number])) {
          return 'Tipo post non valido (reel, story, post)'
        }
        break
    }
    return null
  }, [])

  // La gestione copy/paste è nativa in react-data-grid

  // Definizione colonne
  const columns: Column<ScheduleRow>[] = useMemo(
    () => [
      {
        key: 'videoName',
        name: 'Video',
        width: 180,
        frozen: true,
        editable: false,
      },
      {
        key: 'caption',
        name: 'Didascalia',
        width: 250,
        editable: true,
      },
      {
        key: 'year',
        name: 'Anno',
        width: 80,
        editable: true,
        renderCell: ({ row }) => {
          const error = validateCell(row, 'year')
          return (
            <div className={error ? 'text-red-600' : ''} title={error || ''}>
              {row.year}
            </div>
          )
        },
      },
      {
        key: 'month',
        name: 'Mese',
        width: 80,
        editable: true,
        renderCell: ({ row }) => {
          const error = validateCell(row, 'month')
          return (
            <div className={error ? 'text-red-600' : ''} title={error || ''}>
              {row.month}
            </div>
          )
        },
      },
      {
        key: 'day',
        name: 'Giorno',
        width: 80,
        editable: true,
        renderCell: ({ row }) => {
          const error = validateCell(row, 'day')
          return (
            <div className={error ? 'text-red-600' : ''} title={error || ''}>
              {row.day}
            </div>
          )
        },
      },
      {
        key: 'hour',
        name: 'Orario hh',
        width: 90,
        editable: true,
        renderCell: ({ row }) => {
          const error = validateCell(row, 'hour')
          return (
            <div className={error ? 'text-red-600' : ''} title={error || ''}>
              {String(row.hour).padStart(2, '0')}
            </div>
          )
        },
      },
      {
        key: 'minute',
        name: 'Minuti',
        width: 80,
        editable: true,
        renderCell: ({ row }) => {
          const error = validateCell(row, 'minute')
          return (
            <div className={error ? 'text-red-600' : ''} title={error || ''}>
              {String(row.minute).padStart(2, '0')}
            </div>
          )
        },
      },
      {
        key: 'postType',
        name: 'Tipologia post',
        width: 130,
        editable: true,
        renderEditCell: ({ row, onRowChange }) => (
          <select
            className="w-full h-full px-2 border-0 outline-none"
            value={row.postType}
            onChange={(e) =>
              onRowChange({ ...row, postType: e.target.value as ScheduleRow['postType'] })
            }
            autoFocus
          >
            <option value="">Seleziona...</option>
            <option value="reel">Reel</option>
            <option value="story">Story</option>
            <option value="post">Post</option>
          </select>
        ),
        renderCell: ({ row }) => {
          const error = validateCell(row, 'postType')
          return (
            <div className={error ? 'text-red-600' : ''} title={error || ''}>
              {row.postType ? row.postType.charAt(0).toUpperCase() + row.postType.slice(1) : '-'}
            </div>
          )
        },
      },
      {
        key: 'preview',
        name: 'Preview',
        width: 120,
        editable: false,
        renderCell: ({ row }) => {
          const video = videos.find((v) => v.id === row.videoId)
          if (!video) return <div className="text-gray-400">N/D</div>
          
          return (
            <div className="flex items-center justify-center h-full">
              <video
                src={URL.createObjectURL(video.file)}
                className="h-10 w-16 object-cover rounded"
                muted
                playsInline
              />
            </div>
          )
        },
      },
    ],
    [videos, validateCell]
  )

  const handleRowsChange = useCallback((newRows: ScheduleRow[]) => {
    setRows(newRows)
  }, [])

  // Validazione completa prima dello scheduling
  const validateAllRows = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = []
    
    rows.forEach((row, index) => {
      // Controlla che tutti i campi obbligatori siano compilati
      if (!row.caption.trim()) {
        errors.push(`Riga ${index + 1}: Didascalia mancante`)
      }
      if (!row.postType) {
        errors.push(`Riga ${index + 1}: Tipologia post mancante`)
      }
      
      // Controlla validità data
      const dateError = validateCell(row, 'day')
      if (dateError) {
        errors.push(`Riga ${index + 1}: ${dateError}`)
      }
      
      // Controlla validità ora
      const hourError = validateCell(row, 'hour')
      if (hourError) {
        errors.push(`Riga ${index + 1}: ${hourError}`)
      }
      
      const minuteError = validateCell(row, 'minute')
      if (minuteError) {
        errors.push(`Riga ${index + 1}: ${minuteError}`)
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
    
    if (!selectedProfile) {
      alert('Errore: nessun profilo selezionato')
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
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        {/* Overlay */}
        <div
          className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Drawer */}
        <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
          <div className="w-screen max-w-6xl">
            <div className="h-full flex flex-col bg-white shadow-xl">
              {/* Header */}
              <div className="px-4 py-6 bg-blue-600 sm:px-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-medium text-white">
                      Schedula Video - {selectedProfile?.accountName}
                    </h2>
                    <p className="mt-1 text-sm text-blue-100">
                      {videos.length} {videos.length === 1 ? 'video' : 'video'} • {selectedProfile?.platform}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="ml-3 h-7 w-7 rounded-md bg-blue-700 text-white hover:bg-blue-800 focus:outline-none"
                    onClick={onClose}
                  >
                    <span className="sr-only">Chiudi pannello</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
                <p className="text-sm text-blue-900">
                  <strong>Istruzioni:</strong> Clicca su una cella per modificarla. 
                  Usa Ctrl+C/Ctrl+V per copiare e incollare valori tra le celle. 
                  Usa Shift per selezionare più celle consecutive.
                </p>
              </div>

              {/* Grid */}
              <div className="flex-1 overflow-hidden px-6 py-4">
                <style jsx global>{`
                  .rdg {
                    --rdg-background-color: white;
                    --rdg-header-background-color: #f3f4f6;
                    --rdg-row-hover-background-color: #f9fafb;
                    --rdg-row-selected-background-color: #dbeafe;
                    --rdg-border-color: #e5e7eb;
                    --rdg-color: #111827;
                    --rdg-selection-color: #3b82f6;
                    font-size: 14px;
                  }
                  .rdg-cell {
                    border-right: 1px solid #e5e7eb;
                    border-bottom: 1px solid #e5e7eb;
                    padding: 8px;
                    display: flex;
                    align-items: center;
                  }
                  .rdg-header-cell {
                    font-weight: 600;
                    color: #374151;
                    background-color: #f3f4f6;
                    border-right: 1px solid #d1d5db;
                    border-bottom: 2px solid #d1d5db;
                  }
                  .rdg-cell input,
                  .rdg-cell select {
                    width: 100%;
                    border: none;
                    background: transparent;
                    outline: none;
                    font-size: 14px;
                    color: #111827;
                  }
                  .rdg-cell input:focus,
                  .rdg-cell select:focus {
                    background-color: #fff;
                    border: 1px solid #3b82f6;
                    border-radius: 4px;
                    padding: 4px;
                  }
                `}</style>
                <DataGrid
                  columns={columns}
                  rows={rows}
                  onRowsChange={handleRowsChange}
                  rowKeyGetter={(row: ScheduleRow) => row.id}
                  className="rdg-light"
                  style={{ height: '100%', border: '1px solid #e5e7eb' }}
                />
              </div>

              {/* Footer */}
              <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    {rows.length} {rows.length === 1 ? 'video da schedulare' : 'video da schedulare'}
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                      onClick={onClose}
                      disabled={isScheduling}
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:bg-gray-400 disabled:cursor-not-allowed"
                      onClick={handleScheduleClick}
                      disabled={isScheduling}
                    >
                      {isScheduling ? 'Scheduling...' : 'Schedula Tutti'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
