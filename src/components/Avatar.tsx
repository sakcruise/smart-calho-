export function Avatar({ name, colour, size = 48 }: { name: string; colour: string; size?: number }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, background: colour, fontSize: size * 0.46 }}
      className="flex shrink-0 items-center justify-center rounded-full font-black text-white">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}
