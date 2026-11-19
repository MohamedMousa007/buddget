import type { ReactNode } from 'react'

/** The values behind a chart as a visually hidden table: the chart itself is a picture (`role="img"`) and shows values only in a pointer tooltip. */
export function ChartDataTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: ReactNode[][] }) {
  return (
    // The clip is on a block wrapper: `sr-only` on a <table> does not shrink it (tables size to content),
    // so its columns widened the whole page on a phone (Reports scrolled to 513px at 375px wide).
    <div className="sr-only">
      <table>
      <caption>{caption}</caption>
      <thead>
        <tr>{headers.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((cells, i) => (
          <tr key={i}>{cells.map((cell, j) => (j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j}>{cell}</td>))}</tr>
        ))}
      </tbody>
      </table>
    </div>
  )
}
