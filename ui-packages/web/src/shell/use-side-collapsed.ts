import { useState } from 'react'

// The only layout preference held by hand. Panel widths are persisted by the
// library's useDefaultLayout, and the conversation panel's collapsed state *is*
// its width — keeping a separate "is it open" boolean in step with the panel is
// what forces a two-way sync effect, and a guard to stop that effect looping.
// Not having the boolean removes both.
const KEY = 'idea.shell.side-collapsed'

const read = () => {
  try {
    return globalThis.localStorage?.getItem(KEY) === '1'
  } catch {
    // Private mode or storage disabled: the rail still works, it just starts open.
    return false
  }
}

export const useSideCollapsed = () => {
  const [collapsed, setCollapsed] = useState(read)

  // Written where the change happens rather than in an effect watching the
  // value. An effect would run once on mount for nothing, and would tie
  // persistence to a dependency comparison rather than to the click that caused
  // it — which is the failure mode where a value quietly stops being saved.
  const toggle = () => {
    const next = !collapsed
    try {
      globalThis.localStorage?.setItem(KEY, next ? '1' : '0')
    } catch {
      // Failing to remember a panel preference is not worth interrupting anyone.
    }
    setCollapsed(next)
  }

  return [collapsed, toggle] as const
}
