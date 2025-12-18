'use client'

import { HotTable } from '@handsontable/react'
import { registerAllModules } from 'handsontable/registry'
import 'handsontable/dist/handsontable.full.min.css'
import { useRef, forwardRef, useImperativeHandle } from 'react'

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

export interface HandsontableWrapperRef {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getHotInstance: () => any
}

const HandsontableWrapper = forwardRef<HandsontableWrapperRef, HandsontableWrapperProps>(
  ({ data, columns, colHeaders, colWidths, onCellClick, onChange, cellsCallback }, ref) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hotRef = useRef<any>(null)

    useImperativeHandle(ref, () => ({
      getHotInstance: () => hotRef.current?.hotInstance
    }))

    return (
      <HotTable
        ref={hotRef}
        data={data}
        licenseKey="non-commercial-and-evaluation"
        height="100%"
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
)

HandsontableWrapper.displayName = 'HandsontableWrapper'

export default HandsontableWrapper
