export type Point = { x: number; y: number }
export type Rectangle = Point & { width: number; height: number }
export type ImageRaster = { data: Uint8ClampedArray; width: number; height: number }

export type HexContour = Point & { width: number; height: number }

export type GridGeometry = {
  radius: number
  center: Point
  stepX: number
  stepY: number
  paper: Rectangle
  confidence: number
  radiusConfidence: number
}

export type AspectCandidate = { aspect: string; score: number }
export type RecognizedCell = {
  row: number
  column: number
  center: Point
  type: 'empty' | 'obstacle' | 'aspect' | 'unknown'
  aspect?: string
  confidence: number
  ringScore: number
  aspectScore: number
  candidates: AspectCandidate[]
}

export type RecognitionDebug = {
  grayscale: ImageRaster
  edges: ImageRaster
  contours: HexContour[]
}

export type RecognitionResult = {
  width: number
  height: number
  geometry: GridGeometry
  cells: RecognizedCell[]
  debug: RecognitionDebug
}
