'use client'

/**
 * VideoSchedulerDrawer Component
 * 
 * IMPORTANTE: Tutti gli orari sono gestiti in formato italiano (Europe/Rome, UTC+1)
 * - year, month, day, hour, minute: sempre in orario italiano
 * - Nessuna conversione UTC necessaria
 * - OnlySocial API usa lo stesso fuso orario
 */

import { useEffect, useState, useRef } from 'react'
import { HotTable } from '@handsontable/react'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'

registerAllModules()

// Suppress theme deprecation warning by not using any theme class
// The default rendering will be used

export interface VideoFile {
  id: string
  name: string
  url: string
}

export interface ScheduleRow {
  id: string
  caption: string
  year: number    // Anno in orario italiano
  month: number   // Mese in orario italiano (1-12)
  day: number     // Giorno in orario italiano
  hour: number    // Ora in orario italiano (0-23)
  minute: number  // Minuto in orario italiano (0-59)
  postType: 'reel' | 'story' | 'post'
  videoId: string
  videoName: string
}

interface VideoSchedulerDrawerProps {
  videos: VideoFile[]
  onSchedule: (scheduleData: ScheduleRow[]) => Promise<void>
}

export default function VideoSchedulerDrawer({ videos, onSchedule }: VideoSchedulerDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [data, setData] = useState<(string | number)[][]>([])
  const [loading, setLoading] = useState(false)
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hotTableRef = useRef<any>(null)

  useEffect(() => {
    if (videos.length > 0) {
      setIsOpen(true)
      const now = new Date()
      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() + 1 // 0-based, quindi +1
      const currentDay = now.getDate()
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()
      
      const newData = videos.map(video => [
        '', // caption
        currentYear, // year
        currentMonth, // month
        currentDay, // day
        currentHour, // hour
        currentMinute, // minute
        '', // postType
        video.name, // videoName (readonly)
        'Vedi', // preview button text
        video.url, // videoUrl (hidden)
        video.id, // videoId (hidden)
        '' // error message (last column)
      ])
      console.log('📹 Initial video data:', newData)
      setData(newData)
    } else {
      setIsOpen(false)
    }
  }, [videos])

  useEffect(() => {
    console.log('🎥 Selected video URL changed:', selectedVideoUrl)
  }, [selectedVideoUrl])

  const columns = [
    {
      data: 0,
      title: 'Didascalia',
      type: 'text',
      width: 300
    },
    {
      data: 1,
      title: 'Anno',
      type: 'numeric',
      width: 80
    },
    {
      data: 2,
      title: 'Mese',
      type: 'numeric',
      width: 70
    },
    {
      data: 3,
      title: 'Giorno',
      type: 'numeric',
      width: 80
    },
    {
      data: 4,
      title: 'Ora',
      type: 'numeric',
      width: 70
    },
    {
      data: 5,
      title: 'Minuti',
      type: 'numeric',
      width: 80
    },
    {
      data: 6,
      title: 'Tipologia',
      type: 'dropdown',
      source: ['reel', 'story', 'post'],
      width: 110
    },
    {
      data: 7,
      title: 'File',
      type: 'text',
      readOnly: true,
      width: 200
    },
    {
      data: 8,
      title: 'Anteprima',
      type: 'text',
      readOnly: true,
      width: 100,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
      renderer: function(instance: any, td: HTMLTableCellElement, row: number, col: number) {
        td.innerHTML = ''
        td.style.padding = '4px'
        td.style.textAlign = 'center'
        
        const button = document.createElement('button')
        button.innerHTML = '👁️ Vedi'
        button.className = 'px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors'
        button.onclick = (e) => {
          e.preventDefault()
          e.stopPropagation()
          const rowData = data[row]
          console.log('🎬 Click preview button:', { row, rowData, videoUrl: rowData?.[9] })
          if (rowData && rowData[9]) {
            console.log('✅ Setting video URL:', rowData[9])
            setSelectedVideoUrl(rowData[9] as string)
          } else {
            console.error('❌ No video URL found in row', row)
          }
        }
        
        td.appendChild(button)
        return td
      }
    },
    {
      data: 9,
      title: 'URL',
      type: 'text',
      readOnly: true,
      width: 1,
      className: 'htHidden'
    },
    {
      data: 10,
      title: 'ID',
      type: 'text',
      readOnly: true,
      width: 1,
      className: 'htHidden'
    },
    {
      data: 11,
      title: 'Errore',
      type: 'text',
      readOnly: true,
      width: 300,
      className: 'htMiddle',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      renderer: function(instance: any, td: HTMLTableCellElement, row: number, col: number, prop: any, value: string) {
        td.innerHTML = value || ''
        if (value && value.trim() !== '') {
          td.style.color = '#dc2626' // red-600
          td.style.fontWeight = '600'
        } else {
          td.style.color = ''
          td.style.fontWeight = ''
        }
        return td
      }
    }
  ]

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
    const now = new Date()
    const oneHourFromNow = new Date(now.getTime() + (60 * 60 * 1000)) // +1 ora da ora
    
    return scheduledDate > oneHourFromNow
  }

  const handleScheduleAll = async () => {
    if (!hotTableRef.current) return

    const hotInstance = hotTableRef.current.hotInstance
    if (!hotInstance) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tableData = hotInstance.getSourceData() as any[][]
    
    console.log('📊 Table data:', tableData)

    // Validate all rows
    const errors: string[] = []
    const scheduleData: ScheduleRow[] = []

    // Prima pulisci tutti i messaggi di errore
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tableData.forEach((row: any[], index: number) => {
      hotInstance.setDataAtCell(index, 11, '', 'auto')
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tableData.forEach((row: any[], index: number) => {
      const caption = String(row[0] || '')
      const year = Number(row[1])
      const month = Number(row[2])
      const day = Number(row[3])
      const hour = Number(row[4])
      const minute = Number(row[5])
      const postType = row[6] as string
      const videoName = row[7] as string
      // row[8] is the preview button text (ignored)
      // row[9] is the videoUrl (ignored)
      const videoId = row[10] as string

      console.log(`Row ${index}:`, { caption, year, month, day, hour, minute, postType, videoName, videoId, rowLength: row.length })

      // Validate required fields
      if (!videoId) {
        const errorMsg = 'Caricare un video prima di procedere'
        errors.push(`Riga ${index + 1}: ${errorMsg}`)
        hotInstance.setDataAtCell(index, 11, errorMsg, 'auto')
        return
      }

      if (!postType || !['reel', 'story', 'post'].includes(postType)) {
        const errorMsg = 'Selezionare una tipologia: reel, story o post'
        errors.push(`Riga ${index + 1}: ${errorMsg}`)
        hotInstance.setDataAtCell(index, 11, errorMsg, 'auto')
        return
      }

      // Validate date
      if (!isValidDate(year, month, day, hour, minute)) {
        const errorMsg = 'Inserire una data valida'
        errors.push(`Riga ${index + 1}: ${errorMsg}`)
        hotInstance.setDataAtCell(index, 11, errorMsg, 'auto')
        return
      }

      // Verifica che il video sia programmato con almeno 1 ora di anticipo
      if (!isAtLeastOneHourInFuture(year, month, day, hour, minute)) {
        const errorMsg = '⚠️ Necessario programmare il contenuto tra minimo un\'ora'
        errors.push(`Riga ${index + 1}: ${errorMsg}`)
        hotInstance.setDataAtCell(index, 11, errorMsg, 'auto')
        return
      }

      scheduleData.push({
        id: `schedule-${index}`,
        caption: caption || '', // Didascalia opzionale
        year,
        month,
        day,
        hour,
        minute,
        postType: postType as 'reel' | 'story' | 'post',
        videoId,
        videoName
      })
    })

    if (errors.length > 0) {
      console.error('❌ Errori di validazione:', errors)
      console.warn('⚠️ Correggi gli errori visualizzati nella colonna "Errore"')
      return
    }

    if (scheduleData.length === 0) {
      console.warn('⚠️ Nessun video da schedulare')
      return
    }

    setLoading(true)
    try {
      await onSchedule(scheduleData)
      setIsOpen(false)
      setData([])
    } catch (error) {
      console.error('Schedule error:', error)
      // Non mostrare popup, solo log nella console
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    // Chiudi senza conferma
    setIsOpen(false)
    setData([])
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[95vw] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Schedula Video
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {videos.length} video{videos.length !== 1 ? ' caricati' : ' caricato'} • 
              Ctrl+C/V per copiare • Ctrl+Z per annullare • Trascina per riempire
            </p>
          </div>
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

        {/* Main Content: Spreadsheet + Video Preview */}
        <div className="flex-1 overflow-hidden flex">
          {/* Spreadsheet */}
          <div className={`${selectedVideoUrl ? 'w-2/3' : 'w-full'} overflow-auto p-6 transition-all`}>
            <div className="border rounded-lg overflow-hidden">
            <HotTable
              ref={hotTableRef}
              data={data}
              columns={columns}
              colHeaders={true}
              rowHeaders={true}
              width="100%"
              height="500"
              licenseKey="non-commercial-and-evaluation"
              copyPaste={true}
              undo={true}
              fillHandle={true}
              contextMenu={true}
              manualColumnResize={true}
              enterMoves={{ row: 1, col: 0 }}
              hiddenColumns={{
                columns: [9, 10],
                indicators: false
              }}
              cells={(row, col) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const cellProperties: any = {}
                
                // Validate date fields
                if (col >= 1 && col <= 5) {
                  const rowData = data[row]
                  if (rowData) {
                    const year = Number(rowData[1])
                    const month = Number(rowData[2])
                    const day = Number(rowData[3])
                    const hour = Number(rowData[4])
                    const minute = Number(rowData[5])

                    if (!isValidDate(year, month, day, hour, minute)) {
                      cellProperties.className = 'htInvalid'
                    }
                  }
                }

                return cellProperties
              }}
            />
          </div>

          {/* Legend */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Istruzioni:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Ctrl+C / Ctrl+V</strong>: Copia e incolla celle</li>
              <li>• <strong>Ctrl+Z / Ctrl+Y</strong>: Annulla e ripristina modifiche</li>
              <li>• <strong>Invio</strong>: Passa alla cella sotto</li>
              <li>• <strong>Trascina l&apos;angolo</strong>: Riempi celle adiacenti</li>
              <li>• <strong>Shift+Click</strong>: Seleziona più celle</li>
              <li>• <strong>Click destro</strong>: Menu contestuale</li>
              <li>• <strong>Tipologia</strong>: Scegli tra reel, story, post</li>
              <li>• <strong>Data</strong>: Deve essere nel futuro</li>
            </ul>
          </div>
        </div>

        {/* Video Preview Panel */}
        {selectedVideoUrl && (
          <div className="w-1/3 border-l p-6 overflow-auto bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Anteprima Video</h3>
              <button
                onClick={() => {
                  console.log('❌ Closing video preview')
                  setSelectedVideoUrl(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="bg-black rounded-lg overflow-hidden">
              <video
                src={selectedVideoUrl}
                controls
                className="w-full h-auto max-h-[60vh]"
                onLoadStart={() => console.log('🎬 Video loading:', selectedVideoUrl)}
                onError={(e) => {
                  console.error('❌ Video error:', e, selectedVideoUrl)
                  console.error('Video element:', e.target)
                  // Check if it's a CORS or network error
                  const videoEl = e.target as HTMLVideoElement
                  if (videoEl.error) {
                    console.error('Video error code:', videoEl.error.code, 'Message:', videoEl.error.message)
                  }
                }}
                onCanPlay={() => console.log('✅ Video can play:', selectedVideoUrl)}
              >
                Il tuo browser non supporta il tag video.
              </video>
              <p className="text-white text-xs mt-2 p-2">
                Se il video non si carica, l&apos;URL potrebbe essere scaduto (presigned URL valido 10 minuti).
              </p>
            </div>
          </div>
        )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            onClick={handleScheduleAll}
            disabled={loading || data.length === 0}
            className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
              'Schedula Tutti'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
