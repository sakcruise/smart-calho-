import { Bike, BookOpen, Cake, Crown, Film, Gamepad2, Gift, IceCreamCone, Palette, PiggyBank, Pizza, Popcorn, Puzzle, Rocket, Tent, Ticket, TreePine, Trophy, Waves, type LucideIcon } from 'lucide-react'
import { useSignedUrl } from './useRewards'

export const REWARD_ICONS: Record<string, { Icon: LucideIcon; label: string }> = {
  gift: { Icon: Gift, label: 'Present' },
  ticket: { Icon: Ticket, label: 'Day out' },
  film: { Icon: Film, label: 'Cinema' },
  popcorn: { Icon: Popcorn, label: 'Movie night' },
  icecream: { Icon: IceCreamCone, label: 'Ice cream' },
  pizza: { Icon: Pizza, label: 'Pizza' },
  cake: { Icon: Cake, label: 'Treat' },
  toy: { Icon: Puzzle, label: 'Toy' },
  game: { Icon: Gamepad2, label: 'Game time' },
  book: { Icon: BookOpen, label: 'New book' },
  park: { Icon: TreePine, label: 'Park trip' },
  swim: { Icon: Waves, label: 'Swimming' },
  bike: { Icon: Bike, label: 'Bike ride' },
  art: { Icon: Palette, label: 'Craft' },
  camp: { Icon: Tent, label: 'Adventure' },
  money: { Icon: PiggyBank, label: 'Pocket money' },
  crown: { Icon: Crown, label: 'Choose dinner' },
  rocket: { Icon: Rocket, label: 'Something big' },
  trophy: { Icon: Trophy, label: 'Trophy' },
}

/** A reward's photo if it has one, otherwise its icon on a tinted tile. */
export function RewardArt({ icon, imagePath, size = 64, colour = '#F2A51A' }: { icon: string; imagePath: string | null; size?: number; colour?: string }) {
  const url = useSignedUrl(imagePath)
  const { Icon } = REWARD_ICONS[icon] ?? REWARD_ICONS.gift
  if (url) return <img src={url} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-2xl object-cover" />
  return (
    <span style={{ width: size, height: size, background: `${colour}22`, color: colour }} className="flex shrink-0 items-center justify-center rounded-2xl">
      <Icon aria-hidden="true" size={size * 0.56} strokeWidth={2.2} />
    </span>
  )
}
