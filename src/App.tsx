import { Clock } from './features/dashboard/Clock'

const nav = ['Home', 'Week', 'Tasks', 'Lists', 'Admin'] as const

export default function App() {
  return (
    <div className="flex h-full flex-col">
      <main className="flex flex-1 items-center px-[6vw]">
        <Clock />
      </main>
      <nav className="flex justify-around border-t border-white/10 py-4 text-lg">
        {nav.map((item) => (
          <button
            key={item}
            className="rounded-2xl px-8 py-3 first:bg-[var(--accent)] first:text-white"
            type="button"
          >
            {item}
          </button>
        ))}
      </nav>
    </div>
  )
}
