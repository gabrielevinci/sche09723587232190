'use client'

/**
 * VideoSchedulerDrawer Component - Excel-like Version
 * 
 * Workflow:
 * 1. L'utente clicca "Carica + Schedula" → appare subito il drawer
 * 2. L'utente seleziona uno o più account (della stessa piattaforma) dalla parte superiore
 * 3. L'utente aggiunge righe nella tabella Excel-like (Handsontable)
 * 4. Per ogni riga può caricare un contenuto (opzionale per Telegram, obbligatorio per Instagram)
 * 5. Al click su "Schedula Tutti" i video vengono caricati su DigitalOcean e salvati nel DB
 * 
 * IMPORTANTE: Tutti gli orari sono gestiti in formato italiano (Europe/Rome)
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { HotTable } from '@handsontable/react'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import Handsontable from 'handsontable'

// Registra tutti i moduli di Handsontable
registerAllModules()

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

// Interfaccia per i dati della tabella
interface TableRow {
  caption: string
  year: number
  month: number
  day: number
  hour: number
  minute: number
  postType: string
  contenuto: string
}

export default function VideoSchedulerDrawer({ 
  isOpen, 
  onClose, 
  accounts, 
  onSchedule 
}: VideoSchedulerDrawerProps) {
  // Stato per SSR
  const [isMounted, setIsMounted] = useState(false)
  
  // Stato account selezionati
  const [selectedAccounts, setSelectedAccounts] = useState<SocialAccount[]>([])
  
  // Dati tabella (per Handsontable)
  const [tableData, setTableData] = useState<TableRow[]>([])
  
  // File associati alle righe (indice riga -> File)
  const [rowFiles, setRowFiles] = useState<{ [key: number]: File }>({})
  
  // Loading state
  const [loading, setLoading] = useState(false)
  
  // Preview video/immagine
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewType, setPreviewType] = useState<'video' | 'image' | null>(null)
  
  // Ref per la tabella Handsontable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hotRef = useRef<any>(null)
  
  // Ref per input file nascosto
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentFileRow, setCurrentFileRow] = useState<number | null>(null)

  // Mount effect per SSR
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Piattaforma selezionata (prima della selezione account)
  const selectedPlatform = useMemo(() => {
    if (selectedAccounts.length === 0) return null
    return selectedAccounts[0].platform
  }, [selectedAccounts])

  // Genera array anni (corrente + 2)
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return [currentYear, currentYear + 1, currentYear + 2]
  }, [])

  // Genera array mesi (1-12)
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), [])

  // Genera array giorni (1-31)
  const days = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), [])

  // Genera array ore (0-23)
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])

  // Genera array minuti (0-59)
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), [])

  // Tipi di post disponibili
  const postTypes = useMemo(() => ['reel', 'story', 'post'], [])

  // Crea riga di default con data/ora corrente
  const createDefaultRow = useCallback((): TableRow => {
    const now = new Date()
    return {
      caption: '',
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
      postType: 'reel',
      contenuto: '📤 Carica'
    }
  }, [])

  // Inizializza quando si apre
  useEffect(() => {
    if (isOpen) {
      setSelectedAccounts([])
      setTableData([createDefaultRow()])
      setRowFiles({})
      setPreviewUrl(null)
      setPreviewType(null)
    }
  }, [isOpen, createDefaultRow])

  // Toggle selezione account
  const toggleAccountSelection = useCallback((account: SocialAccount) => {
    if (!account.isActive) return
    
    setSelectedAccounts(prev => {
      const isSelected = prev.some(a => a.id === account.id)
      
      if (isSelected) {
        return prev.filter(a => a.id !== account.id)
      } else {
        if (prev.length === 0 || prev[0].platform === account.platform) {
          return [...prev, account]
        }
        return prev
      }
    })
  }, [])

  // Aggiungi nuova riga
  const addNewRow = useCallback(() => {
    setTableData(prev => [...prev, createDefaultRow()])
  }, [createDefaultRow])

  // Rimuovi righe selezionate
  const removeSelectedRows = useCallback(() => {
    const hot = hotRef.current?.hotInstance
    if (!hot) return

    const selected = hot.getSelected()
    if (!selected || selected.length === 0) return

    const rowsToRemove = new Set<number>()
    selected.forEach((selection: number[]) => {
      const [startRow, , endRow] = selection
      for (let i = Math.min(startRow, endRow); i <= Math.max(startRow, endRow); i++) {
        rowsToRemove.add(i)
      }
    })

    setTableData(prev => prev.filter((_, i) => !rowsToRemove.has(i)))
    setRowFiles(prev => {
      const newFiles: { [key: number]: File } = {}
      let newIndex = 0
      Object.keys(prev).forEach(key => {
        const oldIndex = parseInt(key)
        if (!rowsToRemove.has(oldIndex)) {
          newFiles[newIndex] = prev[oldIndex]
          newIndex++
        }
      })
      return newFiles
    })
  }, [])

  // Handler selezione file
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && currentFileRow !== null) {
      setRowFiles(prev => ({
        ...prev,
        [currentFileRow]: file
      }))
      
      setTableData(prev => {
        const newData = [...prev]
        if (newData[currentFileRow]) {
          const fileName = file.name.length > 12 ? file.name.substring(0, 10) + '...' : file.name
          newData[currentFileRow] = {
            ...newData[currentFileRow],
            contenuto: `✅ ${fileName}`
          }
        }
        return newData
      })

      // Force re-render della tabella
      setTimeout(() => {
        hotRef.current?.hotInstance?.render()
      }, 50)
    }
    
    e.target.value = ''
    setCurrentFileRow(null)
  }, [currentFileRow])

  // Chiudi preview
  const closePreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    setPreviewType(null)
  }, [previewUrl])

  // Validazione
  const validateData = useCallback((): { valid: boolean; error?: string } => {
    if (selectedAccounts.length === 0) {
      return { valid: false, error: 'Seleziona almeno un account' }
    }

    if (tableData.length === 0) {
      return { valid: false, error: 'Aggiungi almeno un post' }
    }

    const isInstagram = selectedPlatform?.toLowerCase().includes('instagram')

    for (let i = 0; i < tableData.length; i++) {
      const row = tableData[i]
      
      const hasFile = rowFiles[i] !== undefined
      const hasCaption = row.caption && row.caption.trim() !== ''
      
      if (isInstagram && !hasFile) {
        return { valid: false, error: `Riga ${i + 1}: Instagram richiede un contenuto video/immagine` }
      }
      
      if (!hasCaption && !hasFile) {
        return { valid: false, error: `Riga ${i + 1}: Inserisci almeno una caption o un contenuto` }
      }

      const date = new Date(row.year, row.month - 1, row.day, row.hour, row.minute)
      if (isNaN(date.getTime())) {
        return { valid: false, error: `Riga ${i + 1}: Data non valida` }
      }
    }

    return { valid: true }
  }, [selectedAccounts, tableData, rowFiles, selectedPlatform])

  // Schedula tutti
  const handleScheduleAll = useCallback(async () => {
    const validation = validateData()
    if (!validation.valid) {
      alert(validation.error)
      return
    }

    setLoading(true)

    try {
      const posts: PostRow[] = tableData.map((row, index) => ({
        id: `post-${Date.now()}-${index}`,
        caption: row.caption,
        year: row.year,
        month: row.month,
        day: row.day,
        hour: row.hour,
        minute: row.minute,
        postType: row.postType as 'reel' | 'story' | 'post',
        file: rowFiles[index] || null,
        filePreviewUrl: null
      }))

      await onSchedule({
        accounts: selectedAccounts,
        posts
      })

      onClose()
    } catch (error) {
      console.error('Errore schedulazione:', error)
      alert('Errore durante la schedulazione')
    } finally {
      setLoading(false)
    }
  }, [tableData, rowFiles, selectedAccounts, validateData, onSchedule, onClose])

  // Handler cambio dati Handsontable
  const handleTableChange = useCallback((changes: Handsontable.CellChange[] | null) => {
    if (!changes) return

    setTableData(prev => {
      const newData = [...prev]
      changes.forEach(([row, prop, , newValue]) => {
        if (newData[row]) {
          const key = prop as keyof TableRow
          if (key === 'year' || key === 'month' || key === 'day' || key === 'hour' || key === 'minute') {
            newData[row] = { ...newData[row], [key]: parseInt(newValue) || 0 }
          } else {
            newData[row] = { ...newData[row], [key]: newValue }
          }
        }
      })
      return newData
    })
  }, [])

  // Handler click sulla cella contenuto
  const handleCellClick = useCallback((row: number, col: number) => {
    // Colonna 7 è "Contenuto"
    if (col === 7) {
      const hasFile = rowFiles[row] !== undefined
      if (hasFile) {
        // Mostra preview
        const file = rowFiles[row]
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
        setPreviewType(file.type.startsWith('video/') ? 'video' : 'image')
      } else {
        // Apri file picker
        setCurrentFileRow(row)
        fileInputRef.current?.click()
      }
    }
  }, [rowFiles])

  // Colonne configurazione
  const columns = useMemo(() => [
    { data: 'caption', type: 'text', width: 250 },
    { data: 'year', type: 'dropdown', source: years.map(String), width: 80 },
    { data: 'month', type: 'dropdown', source: months.map(String), width: 70 },
    { data: 'day', type: 'dropdown', source: days.map(String), width: 70 },
    { data: 'hour', type: 'dropdown', source: hours.map(String), width: 65 },
    { data: 'minute', type: 'dropdown', source: minutes.map(String), width: 70 },
    { data: 'postType', type: 'dropdown', source: postTypes, width: 80 },
    { data: 'contenuto', type: 'text', width: 150, readOnly: true }
  ], [years, months, days, hours, minutes, postTypes])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer - MOLTO PIÙ GRANDE */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-[90vw] xl:max-w-[85vw] bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-600 to-purple-600">
          <h2 className="text-xl font-bold text-white">Schedula Post</h2>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Sezione Account */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Seleziona Account {selectedPlatform && `(${selectedPlatform})`}
            </h3>
            <div className="flex flex-wrap gap-2">
              {accounts.map(account => {
                const isSelected = selectedAccounts.some(a => a.id === account.id)
                const isDisabled = !account.isActive || 
                  (selectedPlatform !== null && selectedPlatform !== account.platform && selectedAccounts.length > 0)
                
                return (
                  <button
                    key={account.id}
                    onClick={() => toggleAccountSelection(account)}
                    disabled={!!isDisabled}
                    className={`
                      px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium
                      ${isSelected 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : isDisabled
                          ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'border-gray-200 hover:border-blue-300 text-gray-700'
                      }
                    `}
                  >
                    <span className="mr-2">
                      {account.platform.toLowerCase().includes('instagram') ? '📸' : 
                       account.platform.toLowerCase().includes('telegram') ? '✈️' : 
                       account.platform.toLowerCase().includes('tiktok') ? '🎵' : '📱'}
                    </span>
                    {account.accountName}
                    {isSelected && <span className="ml-2">✓</span>}
                  </button>
                )
              })}
            </div>
            {selectedPlatform && (
              <p className="text-xs text-gray-500 mt-2">
                💡 Puoi selezionare più account della stessa piattaforma
              </p>
            )}
          </div>

          {/* Tabella Excel-like */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                Post da schedulare
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={addNewRow}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Aggiungi Riga
                </button>
                <button
                  onClick={removeSelectedRows}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Rimuovi Selezionate
                </button>
              </div>
            </div>

            {/* Container tabella con altezza fissa grande */}
            <div className="border rounded-lg overflow-hidden bg-white" style={{ height: '500px' }}>
              {isMounted && (
                <HotTable
                  ref={hotRef}
                  data={tableData}
                  licenseKey="non-commercial-and-evaluation"
                  height="100%"
                  width="100%"
                  stretchH="all"
                  rowHeaders={true}
                  colHeaders={['Caption', 'Anno', 'Mese', 'Giorno', 'Ora', 'Minuto', 'Tipo', 'Contenuto']}
                  columns={columns}
                  afterChange={handleTableChange}
                  afterOnCellMouseDown={(_event, coords) => {
                    if (coords.row >= 0) {
                      handleCellClick(coords.row, coords.col)
                    }
                  }}
                  manualColumnResize={true}
                  manualRowResize={true}
                  contextMenu={['row_above', 'row_below', 'remove_row', '---------', 'copy', 'cut']}
                  copyPaste={true}
                  fillHandle={true}
                  autoWrapRow={true}
                  autoWrapCol={true}
                  selectionMode="multiple"
                  outsideClickDeselects={false}
                  rowHeights={35}
                  colWidths={[250, 80, 70, 70, 65, 70, 80, 150]}
                  cells={(row, col) => {
                    const cellProperties: Handsontable.CellMeta = {}
                    if (col === 7) {
                      // Colonna Contenuto - stile speciale
                      cellProperties.className = rowFiles[row] 
                        ? 'htCenter htMiddle cursor-pointer bg-green-50 text-green-700 font-medium'
                        : 'htCenter htMiddle cursor-pointer bg-blue-50 text-blue-600 font-medium hover:bg-blue-100'
                    }
                    return cellProperties
                  }}
                />
              )}
            </div>

            <p className="text-xs text-gray-500 mt-2">
              💡 Usa Ctrl+Click per selezioni multiple, Shift+Click per intervalli. Copia/incolla con Ctrl+C/V. Clicca su &quot;Contenuto&quot; per caricare file.
            </p>
          </div>
        </div>

        {/* Footer fisso */}
        <div className="flex-shrink-0 border-t px-6 py-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {selectedAccounts.length} account selezionati • {tableData.length} post
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={handleScheduleAll}
                disabled={loading || selectedAccounts.length === 0 || tableData.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Schedulazione...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Schedula Tutti
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Input file nascosto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Modal Preview */}
      {previewUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80" onClick={closePreview}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <button
              onClick={closePreview}
              className="absolute -top-10 right-0 text-white hover:text-gray-300"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {previewType === 'video' ? (
              <video
                src={previewUrl}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] rounded-lg"
              />
            ) : (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-w-full max-h-[80vh] rounded-lg"
              />
            )}
          </div>
        </div>
      )}

      {/* Stili custom per Handsontable */}
      <style jsx global>{`
        .handsontable {
          font-size: 13px !important;
          font-family: inherit !important;
        }
        .handsontable th {
          background: #f3f4f6 !important;
          font-weight: 600 !important;
          color: #374151 !important;
          border-color: #e5e7eb !important;
        }
        .handsontable td {
          vertical-align: middle !important;
          border-color: #e5e7eb !important;
        }
        .handsontable tr:nth-child(even) td {
          background: #fafafa;
        }
        .handsontable td.area {
          background: #dbeafe !important;
        }
        .handsontable td.current {
          background: #bfdbfe !important;
        }
        .handsontable .htDropdownMenu {
          z-index: 9999 !important;
        }
        .handsontable td.cursor-pointer {
          cursor: pointer !important;
        }
        .handsontable td.bg-green-50 {
          background-color: #f0fdf4 !important;
        }
        .handsontable td.text-green-700 {
          color: #15803d !important;
        }
        .handsontable td.bg-blue-50 {
          background-color: #eff6ff !important;
        }
        .handsontable td.text-blue-600 {
          color: #2563eb !important;
        }
        .handsontable td.font-medium {
          font-weight: 500 !important;
        }
      `}</style>
    </div>
  )
}
