import type { ReactNode } from 'react'

/** The values behind a chart as a visually hidden table: the chart itself is a picture (`role="img"`) and shows values only in a pointer tooltip. */
export function ChartDataTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: ReactNode[][] }) {
  return (
    <table className="sr-only">
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
  )
}
