import Image from 'next/image'
import { aspectIconUrl } from '../lib/catalog'

export function AspectIcon({ aspect, muted = false }: { aspect: string; muted?: boolean }) {
  return <Image className="aspect-icon" src={aspectIconUrl(aspect, muted)} width={26} height={26} alt="" />
}
