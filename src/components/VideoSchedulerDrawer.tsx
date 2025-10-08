'use client'

import { useEffect, useState, useRef } from 'react'
import { HotTable } from '@handsontable/react'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'

registerAllModules()

export interface VideoFile {
  id: string
  name: string
  url: string
}

export interface ScheduleRow {
  id: string
  caption: string
  year: number
  month: number
  day: number
  hour: number
  minute: number
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hotTableRef = useRef<any>(null)

  useEffect(() => {
    if (videos.length > 0) {
      setIsOpen(true)
      const currentYear = new Date().getFullYear()
      const newData = videos.map(video => [
        '', // caption
        currentYear, // year
        1, // month
        1, // day
        12, // hour
        0, // minute
        '', // postType
        video.name, // videoName (readonly)
        video.id // videoId (hidden)
      ])
      setData(newData)
    } else {
      setIsOpen(false)
    }
  }, [videos])

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
      title: 'Video',
      type: 'text',
      readOnly: true,
      width: 200
    }
    // Column 8 (videoId) is hidden - used internally
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

  const handleScheduleAll = async () => {
    if (!hotTableRef.current) return

    const hotInstance = hotTableRef.current.hotInstance
    if (!hotInstance) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tableData = hotInstance.getData() as any[][]

    // Validate all rows
    const errors: string[] = []
    const scheduleData: ScheduleRow[] = []

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
      const videoId = row[8] as string

      // Validate required fields
      if (!videoId) {
        errors.push(`Riga ${index + 1}: Video mancante`)
        return
      }

      if (!caption || caption.trim() === '') {
        errors.push(`Riga ${index + 1}: Didascalia mancante`)
        return
      }

      if (!postType || !['reel', 'story', 'post'].includes(postType)) {
        errors.push(`Riga ${index + 1}: Tipologia non valida (scegli: reel, story, post)`)
        return
      }

      // Validate date
      if (!isValidDate(year, month, day, hour, minute)) {
        errors.push(`Riga ${index + 1}: Data non valida`)
        return
      }

      const scheduledDate = new Date(year, month - 1, day, hour, minute)
      if (scheduledDate <= new Date()) {
        errors.push(`Riga ${index + 1}: La data deve essere nel futuro`)
        return
      }

      scheduleData.push({
        id: `schedule-${index}`,
        caption,
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
      alert('Errori trovati:\n\n' + errors.join('\n'))
      return
    }

    if (scheduleData.length === 0) {
      alert('Nessun video da schedulare')
      return
    }

    setLoading(true)
    try {
      await onSchedule(scheduleData)
      setIsOpen(false)
      setData([])
    } catch (error) {
      console.error('Schedule error:', error)
      alert('Errore durante la schedulazione. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    if (data.length > 0) {
      const confirm = window.confirm('Chiudendo perderai tutti i dati. Sei sicuro?')
      if (!confirm) return
    }
    setIsOpen(false)
    setData([])
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">
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

        {/* Spreadsheet */}
        <div className="flex-1 overflow-auto p-6">
          <div className="border rounded-lg overflow-hidden ht-theme-main">
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
