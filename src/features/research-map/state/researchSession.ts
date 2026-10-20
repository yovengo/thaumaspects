export type ResearchMode = 'quick' | 'board'

export type ResearchSession = {
  enabled: string[]
  activeAddons: string[]
  from: string
  to: string
  minSpaces: number
  result: string[] | null
  searched: boolean
  mode: ResearchMode
  board: Record<string, string>
  anchorCells: string[]
  boardRoutes: string[][]
  obstacles: string[]
  aspectsOpen: boolean
  paletteQuery: string
  pendingAspect: string | null
  boardSize: number
}

const sessionKey = 'thaumaspects:research-session:v1'
let sessionCache: ResearchSession | null = null

export function getCachedResearchSession() {
  return sessionCache
}

export function readResearchSession(): ResearchSession | null {
  try {
    const raw = window.sessionStorage.getItem(sessionKey)
    if (!raw) return null
    const saved = JSON.parse(raw) as ResearchSession
    if (
      !Array.isArray(saved.enabled) ||
      !Array.isArray(saved.activeAddons) ||
      !Array.isArray(saved.anchorCells) ||
      !Array.isArray(saved.boardRoutes) ||
      !Array.isArray(saved.obstacles) ||
      !saved.board ||
      typeof saved.board !== 'object' ||
      !Number.isInteger(saved.boardSize)
    )
      return null
    return saved
  } catch {
    return null
  }
}

export function saveResearchSession(session: ResearchSession) {
  sessionCache = session
  try {
    window.sessionStorage.setItem(sessionKey, JSON.stringify(session))
  } catch {
    return
  }
}
