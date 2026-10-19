export const defaultBoardSize = 7
export const minimumBoardSize = 5
export const maximumBoardSize = 15
export const hexWidth = 61
export const hexHeight = 53
const hexGap = 6
export const hexColumnStep = 46 + hexGap
export const hexRowStep = hexHeight + hexGap

export const cellId = (row: number, column: number) => `${row}-${column}`
export const parseCellId = (id: string) => id.split('-').map(Number) as [number, number]

function isBoardCell(row: number, column: number, boardSize: number) {
  const radius = Math.floor(boardSize / 2)
  const centerAxialRow = radius - Math.floor((radius - (radius & 1)) / 2)
  const axialColumn = column - radius
  const axialRow = row - Math.floor((column - (column & 1)) / 2) - centerAxialRow
  return (
    Math.max(Math.abs(axialColumn), Math.abs(axialRow), Math.abs(-axialColumn - axialRow)) <= radius
  )
}

export function getBoardCells(boardSize: number) {
  return Array.from({ length: boardSize * boardSize }, (_, index) => ({
    row: Math.floor(index / boardSize),
    column: index % boardSize,
  })).filter(({ row, column }) => isBoardCell(row, column, boardSize))
}

export function getBoardNeighbors(id: string, boardSize: number) {
  const [row, column] = parseCellId(id)
  const directions =
    column % 2 === 0
      ? [
          [-1, 0],
          [1, 0],
          [-1, -1],
          [0, -1],
          [-1, 1],
          [0, 1],
        ]
      : [
          [-1, 0],
          [1, 0],
          [0, -1],
          [1, -1],
          [0, 1],
          [1, 1],
        ]

  return directions
    .map(([rowOffset, columnOffset]) => cellId(row + rowOffset, column + columnOffset))
    .filter((next) => {
      const [nextRow, nextColumn] = parseCellId(next)
      return (
        nextRow >= 0 &&
        nextRow < boardSize &&
        nextColumn >= 0 &&
        nextColumn < boardSize &&
        isBoardCell(nextRow, nextColumn, boardSize)
      )
    })
}

function toCube(id: string) {
  const [row, column] = parseCellId(id)
  const x = column
  const z = row - Math.floor((column - (column & 1)) / 2)
  return [x, -x - z, z]
}

export function boardDistance(from: string, to: string) {
  const a = toCube(from)
  const b = toCube(to)
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))
}

export function routeTurns(route: string[]) {
  let turns = 0
  for (let index = 2; index < route.length; index += 1) {
    const previous = toCube(route[index - 2])
    const current = toCube(route[index - 1])
    const next = toCube(route[index])
    const firstDirection = current.map((value, axis) => value - previous[axis]).join(',')
    const secondDirection = next.map((value, axis) => value - current[axis]).join(',')
    if (firstDirection !== secondDirection) turns += 1
  }
  return turns
}
