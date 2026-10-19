import type { Combinations } from './types'

export function createAspectPathFinder(combinations: Combinations, enabled: Set<string>) {
  const graph: Record<string, string[]> = {}
  const connect = (a: string, b: string) => {
    if (!graph[a]) graph[a] = []
    if (!graph[b]) graph[b] = []
    graph[a].push(b)
    graph[b].push(a)
  }

  Object.entries(combinations).forEach(([compound, parts]) => {
    connect(compound, parts[0])
    connect(compound, parts[1])
  })

  const paths = new Map<string, string[] | null>()

  return (from: string, to: string, minSpaces: number) => {
    const key = `${from}\0${to}\0${minSpaces}`
    if (paths.has(key)) return paths.get(key)!

    const queue: { path: string[]; cost: number }[] = [{ path: [from], cost: 0 }]
    const visited = new Map<string, Set<number>>()

    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost)
      const current = queue.shift()!
      const node = current.path[current.path.length - 1]
      const edges = current.path.length - 1
      const depths = visited.get(node) ?? new Set<number>()
      if (depths.has(edges)) continue
      depths.add(edges)
      visited.set(node, depths)

      if (node === to && current.path.length > minSpaces + 1) {
        paths.set(key, current.path)
        return current.path
      }
      for (const next of graph[node] ?? []) {
        queue.push({
          path: [...current.path, next],
          cost:
            current.cost + (enabled.has(next) ? 1 : 100) + (current.path.includes(next) ? 8 : 0),
        })
      }
    }

    paths.set(key, null)
    return null
  }
}

export function findAspectPath(
  from: string,
  to: string,
  minSpaces: number,
  combinations: Combinations,
  enabled: Set<string>,
) {
  return createAspectPathFinder(combinations, enabled)(from, to, minSpaces)
}
