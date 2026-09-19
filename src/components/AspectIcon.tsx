import { aspectIconUrl } from '../lib/catalog'

export function AspectIcon({ aspect, muted = false }: { aspect: string; muted?: boolean }) {
  return <img className="aspect-icon" src={aspectIconUrl(aspect, muted)} alt="" />
}
