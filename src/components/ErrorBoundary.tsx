import { Component, type ReactNode } from 'react'
import { logError } from '../lib/health'

/** If a screen crashes, say so plainly and restart the app after 10 seconds instead of showing a blank wall. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  private timer: number | undefined

  static getDerivedStateFromError() { return { failed: true } }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    logError(error.message, `${error.stack ?? ''}\n${info.componentStack ?? ''}`)
    this.timer = window.setTimeout(() => window.location.reload(), 10000)
  }

  componentWillUnmount() { window.clearTimeout(this.timer) }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-ink p-8 text-center text-cream">
        <h1 className="text-4xl font-black">Something went wrong</h1>
        <p className="text-xl font-bold text-line">Restarting in a few seconds. Parents can see the details under Parents → System health.</p>
        <button type="button" onClick={() => window.location.reload()} className="rounded-full bg-amber px-8 py-4 text-xl font-extrabold text-ink">Restart now</button>
      </div>
    )
  }
}
