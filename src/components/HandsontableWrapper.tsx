'use client'

import { HotTable } from '@handsontable/react'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import { useEffect, useState } from 'react'

// Registra tutti i moduli di Handsontable
registerAllModules()

interface HandsontableWrapperProps {
  data: object[]
  columns: object[]
  colHeaders: string[]
  colWidths: number[]
  onCellClick: (row: number, col: number) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (changes: any[] | null) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cellsCallback: (row: number, col: number) => any
}

export default function HandsontableWrapper({ 
  data, 
  columns, 
  colHeaders, 
  colWidths, 
  onCellClick, 
  onChange, 
  cellsCallback 
}: HandsontableWrapperProps) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Piccolo delay per assicurarsi che il DOM sia pronto
    const timer = setTimeout(() => {
      setIsReady(true)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-gray-500">Inizializzazione tabella...</div>
      </div>
    )
  }

  return (
    <HotTable
      data={data}
      licenseKey="non-commercial-and-evaluation"
      height={480}
      width="100%"
      stretchH="all"
      rowHeaders={true}
      colHeaders={colHeaders}
      columns={columns}
      afterChange={onChange}
      afterOnCellMouseDown={(_event, coords) => {
        if (coords.row >= 0) {
          onCellClick(coords.row, coords.col)
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
      colWidths={colWidths}
      cells={cellsCallback}
    />
  )
}
