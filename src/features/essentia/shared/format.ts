export const displayItemName = (name: string) => name.replace(/§[0-9a-fk-or]/gi, '')
export const aspectWord = (count: number) => (count === 1 ? 'aspect' : 'aspects')
export const aspectLabel = (aspect: string) =>
  aspect ? aspect.replace(/^./, (letter) => letter.toUpperCase()) : 'Aspect'
export const itemWord = (count: number) => (count === 1 ? 'item' : 'items')
export const scrollBehavior = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
