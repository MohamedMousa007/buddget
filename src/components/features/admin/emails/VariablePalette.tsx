'use client'

import { OptionChip } from '@/components/ui/OptionChip'
import { EMAIL_VARIABLES, EMAIL_VARIABLE_KEYS } from '@/lib/email/variables'
import type { EmailScenario } from '@/lib/email/scenarios'

/**
 * Tap to insert at the caret of the field you last used, or drag onto any text field. Chips the scenario can't use are off.
 * Mouse-down is cancelled so tapping a chip never steals focus (and the caret) from the field.
 */
export function VariablePalette({ scenario, onInsert }: { scenario: EmailScenario; onInsert: (token: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Variables">
      {EMAIL_VARIABLE_KEYS.map((v) => {
        const on = (scenario.vars as readonly string[]).includes(v)
        const token = `{{${v}}}`
        return (
          <OptionChip
            key={v}
            size="sm"
            disabled={!on}
            draggable={on}
            title={on ? EMAIL_VARIABLES[v].label : 'Not available in this email'}
            onMouseDown={(e) => e.preventDefault()}
            onDragStart={(e) => e.dataTransfer.setData('text/plain', token)}
            onClick={() => onInsert(token)}
            className="font-mono"
          >
            {token}
          </OptionChip>
        )
      })}
    </div>
  )
}
