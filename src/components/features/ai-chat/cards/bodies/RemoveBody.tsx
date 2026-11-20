import type { PreviewModel } from '@/lib/buddgy/tools/proposal'
import { Facts, Line } from './parts'

/** Remove: the item's facts and one line on what goes with it. The head and the solid red button come from the shell. */
export function RemoveBody({ preview }: { preview: PreviewModel }) {
  return (
    <>
      <Facts rows={preview.rows} />
      {preview.effect ? <Line>{preview.effect}</Line> : null}
    </>
  )
}
