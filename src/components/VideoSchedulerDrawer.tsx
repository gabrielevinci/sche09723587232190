'use client'

import { useState, useEffect, useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ColDef, ValueSetterParams, ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import '../app/aggrid-custom.css'

// Registra tutti i moduli Community di AG Grid
ModuleRegistry.registerModules([AllCommunityModule])

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

  // Definizione delle colonne con AG Grid
  const columnDefs = useMemo(() => [
    {
      headerName: 'Didascalia',
      field: 'caption' as const,
      editable: true,
      width: 350,
      cellStyle: { color: '#111827', fontWeight: '500' },
    },
    {
      headerName: 'Anno',
      field: 'year' as const,
      editable: true,
      width: 100,
      type: 'numericColumn',
      cellStyle: (params: { data?: ScheduleRow }) => ({
        backgroundColor: !params.data || isValidDate(params.data.year, params.data.month, params.data.day) ? 'white' : '#fee2e2',
        color: '#111827',
      }),
      valueSetter: (params: ValueSetterParams) => {
        const value = parseInt(params.newValue)
        if (!isNaN(value)) {
          params.data.year = value
          return true
        }
        return false
      },
    },
    {
      headerName: 'Mese',
      field: 'month' as const,
      editable: true,
      width: 90,
      type: 'numericColumn',
      cellStyle: (params: { data?: ScheduleRow }) => ({
        backgroundColor: !params.data || isValidDate(params.data.year, params.data.month, params.data.day) ? 'white' : '#fee2e2',
        color: '#111827',
      }),
      valueSetter: (params: ValueSetterParams) => {
        const value = parseInt(params.newValue)
        if (!isNaN(value) && value >= 1 && value <= 12) {
          params.data.month = value
          return true
        }
        return false
      },
    },
    {
      headerName: 'Giorno',
      field: 'day' as const,
      editable: true,
      width: 100,
      type: 'numericColumn',
      cellStyle: (params: { data?: ScheduleRow }) => ({
        backgroundColor: !params.data || isValidDate(params.data.year, params.data.month, params.data.day) ? 'white' : '#fee2e2',
        color: '#111827',
      }),
      valueSetter: (params: ValueSetterParams) => {
        const value = parseInt(params.newValue)
        if (!isNaN(value) && value >= 1 && value <= 31) {
          params.data.day = value
          return true
        }
        return false
      },
    },
    {
      headerName: 'Ora',
      field: 'hour' as const,
      editable: true,
      width: 80,
      type: 'numericColumn',
      cellStyle: { color: '#111827' },
      valueSetter: (params: ValueSetterParams) => {
        const value = parseInt(params.newValue)
        if (!isNaN(value) && value >= 0 && value <= 23) {
          params.data.hour = value
          return true
        }
        return false
      },
    },
    {
      headerName: 'Minuti',
      field: 'minute' as const,
      editable: true,
      width: 90,
      type: 'numericColumn',
      cellStyle: { color: '#111827' },
      valueSetter: (params: ValueSetterParams) => {
        const value = parseInt(params.newValue)
        if (!isNaN(value) && value >= 0 && value <= 59) {
          params.data.minute = value
          return true
        }
        return false
      },
    },
    {
      headerName: 'Tipologia',
      field: 'postType' as const,
      editable: true,
      width: 120,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: {
        values: ['reel', 'story', 'post'],
      },
      cellStyle: { color: '#111827', fontWeight: '500' },
    },
    {
      headerName: 'Preview',
      field: 'videoId' as const,
      editable: false,
      width: 150,
      cellRenderer: (params: { data?: ScheduleRow }) => {
        if (!params.data) return null
        const video = videos.find(v => v.id === params.data!.videoId)
        if (!video) return null
        
        const div = document.createElement('div')
        div.style.cssText = 'display: flex; align-items: center; justify-content: center; height: 100%; padding: 4px;'
        
        const videoElement = document.createElement('video')
        videoElement.src = URL.createObjectURL(video.file)
        videoElement.style.cssText = 'width: 80px; height: 60px; object-fit: cover; border-radius: 4px;'
        videoElement.muted = true
        
        div.appendChild(videoElement)
        return div
      },
    },
  ] as ColDef<ScheduleRow>[], [videos])

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
    filter: false,
    editable: true,
    suppressMovable: true, // Blocca lo spostamento delle colonne
  }), [])

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
            <h2 className="text-2xl font-bold text-white">
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
        <p className="text-base text-gray-900">
          <strong>💡 Funzionalità Excel:</strong> Puoi copiare/incollare da Excel o Google Sheets, trascinare per riempire celle, e modificare direttamente nella griglia.
        </p>
      </div>

      {/* AG Grid Table */}
      <div className="flex-1 px-6 py-4 ag-theme-alpine">
        <AgGridReact<ScheduleRow>
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          enableRangeSelection={true}
          enableFillHandle={true}
          undoRedoCellEditing={true}
          undoRedoCellEditingLimit={20}
          animateRows={true}
          domLayout="autoHeight"
          stopEditingWhenCellsLoseFocus={true}
          singleClickEdit={true}
          suppressMovableColumns={true}
          rowSelection="multiple"
          enableCellTextSelection={true}
          ensureDomOrder={true}
          onCellValueChanged={(event) => {
            // Aggiorna lo stato quando una cella cambia
            const updatedRows = [...rows]
            const index = updatedRows.findIndex(r => r.id === event.data?.id)
            if (index !== -1 && event.data) {
              updatedRows[index] = event.data
              setRows(updatedRows)
            }
          }}
        />
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center">
          <div className="text-base font-medium text-gray-900">
            {rows.length} {rows.length === 1 ? 'video da schedulare' : 'video da schedulare'}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 border-2 border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-100 transition-colors"
              disabled={isScheduling}
            >
              Annulla
            </button>
            <button
              onClick={handleScheduleClick}
              disabled={isScheduling || rows.length === 0}
              className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
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
