import { GTNH_DATASET_BASE_URL, GTNH_VERSION } from '@/config/gtnh'

export type InfusionRecipe = {
  id: string
  itemId: string
  name: string
  iconPath: string | null
  aspects: Record<string, number>
  research: string | null
  instability: number | null
}

type InfusionCatalog = {
  schemaVersion: '1.0.0'
  source: { runId: string; targetGtnhVersion: string }
  recipes: InfusionRecipe[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function parseInfusionCatalog(value: unknown): InfusionCatalog {
  if (
    !isRecord(value) ||
    value.schemaVersion !== '1.0.0' ||
    !isRecord(value.source) ||
    typeof value.source.runId !== 'string' ||
    value.source.targetGtnhVersion !== GTNH_VERSION ||
    !GTNH_DATASET_BASE_URL.replace(/\/+$/, '').endsWith(`/${value.source.runId}`) ||
    !Array.isArray(value.recipes)
  ) {
    throw new Error('Infusion recipes do not match the current GTNH dataset')
  }
  for (const recipe of value.recipes) {
    if (
      !isRecord(recipe) ||
      typeof recipe.id !== 'string' ||
      typeof recipe.itemId !== 'string' ||
      typeof recipe.name !== 'string' ||
      !(recipe.research === null || typeof recipe.research === 'string') ||
      !(recipe.instability === null || typeof recipe.instability === 'number') ||
      !(
        recipe.iconPath === null ||
        (typeof recipe.iconPath === 'string' && /^icons\/[a-f0-9]{64}\.png$/.test(recipe.iconPath))
      ) ||
      !isRecord(recipe.aspects) ||
      Object.keys(recipe.aspects).length === 0 ||
      !Object.values(recipe.aspects).every(
        (amount) => Number.isSafeInteger(amount) && Number(amount) > 0 && Number(amount) <= 9999,
      )
    ) {
      throw new Error('Infusion recipe data is incomplete')
    }
  }
  return value as InfusionCatalog
}

export async function loadInfusionRecipes(signal?: AbortSignal): Promise<InfusionRecipe[]> {
  if (!GTNH_DATASET_BASE_URL || !GTNH_VERSION)
    throw new Error('GTNH dataset configuration is incomplete')
  const base =
    process.env.NODE_ENV === 'development'
      ? '/api/gtnh-dataset'
      : GTNH_DATASET_BASE_URL.replace(/\/+$/, '')
  const response = await fetch(`${base}/prepared/infusion-recipes.json`, { signal })
  if (!response.ok) throw new Error('Infusion recipes are unavailable')
  const catalog = parseInfusionCatalog(await response.json())
  return catalog.recipes
}

export function infusionIconUrl(recipe: InfusionRecipe): string | null {
  if (!recipe.iconPath) return null
  return `${GTNH_DATASET_BASE_URL.replace(/\/+$/, '')}/raw/${recipe.iconPath}`
}
