import {
  Apple, Backpack, Bath, Bed, BookOpen, Brush, Car, Cat, Dog, Droplets, Dumbbell, Fish, Flower2, Footprints,
  Gamepad2, Guitar, Hand, Heart, Home, Laptop, Leaf, Music, Palette, Pencil, Pill, Recycle, Shirt, ShoppingCart,
  Smile, Sparkles, Star, Sun, Trash2, Utensils, WashingMachine, type LucideIcon,
} from 'lucide-react'

/** Task icons by key. Keys are stored in tasks.icon. */
export const TASK_ICONS: Record<string, { Icon: LucideIcon; label: string }> = {
  teeth: { Icon: Smile, label: 'Teeth' },
  dress: { Icon: Shirt, label: 'Clothes' },
  shoes: { Icon: Footprints, label: 'Shoes' },
  bag: { Icon: Backpack, label: 'School bag' },
  wash: { Icon: Droplets, label: 'Wash' },
  bath: { Icon: Bath, label: 'Bath' },
  bed: { Icon: Bed, label: 'Bed' },
  read: { Icon: BookOpen, label: 'Reading' },
  homework: { Icon: Pencil, label: 'Homework' },
  hair: { Icon: Brush, label: 'Hair' },
  breakfast: { Icon: Utensils, label: 'Eat' },
  fruit: { Icon: Apple, label: 'Healthy food' },
  tidy: { Icon: Sparkles, label: 'Tidy' },
  home: { Icon: Home, label: 'House' },
  laundry: { Icon: WashingMachine, label: 'Laundry' },
  bins: { Icon: Trash2, label: 'Bins' },
  recycle: { Icon: Recycle, label: 'Recycling' },
  shop: { Icon: ShoppingCart, label: 'Shopping' },
  plants: { Icon: Flower2, label: 'Plants' },
  garden: { Icon: Leaf, label: 'Garden' },
  dog: { Icon: Dog, label: 'Dog' },
  cat: { Icon: Cat, label: 'Cat' },
  fish: { Icon: Fish, label: 'Fish' },
  music: { Icon: Music, label: 'Music' },
  instrument: { Icon: Guitar, label: 'Practice' },
  art: { Icon: Palette, label: 'Art' },
  exercise: { Icon: Dumbbell, label: 'Exercise' },
  outside: { Icon: Sun, label: 'Outside' },
  screen: { Icon: Laptop, label: 'Screen off' },
  games: { Icon: Gamepad2, label: 'Games' },
  medicine: { Icon: Pill, label: 'Medicine' },
  kind: { Icon: Heart, label: 'Be kind' },
  hands: { Icon: Hand, label: 'Wash hands' },
  car: { Icon: Car, label: 'Car' },
  star: { Icon: Star, label: 'Other' },
}

export function TaskIcon({ name, size = 48, className }: { name: string | null; size?: number; className?: string }) {
  const entry = TASK_ICONS[name ?? 'star'] ?? TASK_ICONS.star
  const { Icon } = entry
  return <Icon aria-hidden="true" size={size} strokeWidth={2.2} className={className} />
}
