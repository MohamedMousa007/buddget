import { describe, expect, it } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlanDeck } from './PlanDeck'
import type { BudgetPlan } from '@/lib/store/types'

const noop = () => {}
const draft: BudgetPlan = { id: 'd1', name: 'Draft plan', categories: [], createdAt: '2026-01-01T00:00:00Z', status: 'draft' }

describe('PlanDeck with only a draft', () => {
  it('still lists the plan and offers a way to add another', () => {
    const html = renderToStaticMarkup(
      h(PlanDeck, {
        plans: [draft], activeId: null, selectedId: 'd1', summaries: {}, income: 0, base: 'USD',
        activeSince: null, onSelect: noop, onActivate: noop, onDuplicate: noop, onRename: noop, onDelete: noop,
        onHistory: noop, onCompare: noop, onNew: noop, onContinue: noop,
      }),
    )
    expect(html).toContain('Draft plan')
  })
})
