import { buildPlans } from '../lib/essentiaPlanner'
import type { ItemAspect, Requirement } from '../lib/essentiaPlanner'

type Calculation = {
  items: ItemAspect[]
  required: Requirement
  preferences: { preferred: string[]; excluded: string[]; stage: string }
}

self.onmessage = (event: MessageEvent<Calculation>) => {
  const { items, required, preferences } = event.data
  const plans = buildPlans(items, required, {
    preferred: new Set(preferences.preferred),
    excluded: new Set(preferences.excluded),
    stage: preferences.stage,
  })
  self.postMessage(plans)
}
