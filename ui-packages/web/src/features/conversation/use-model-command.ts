import { useState, type KeyboardEvent } from 'react'
import { modelSuggestions } from './model-command'

export const useModelCommand = (
  draft: string,
  models: readonly string[],
  choose: (model: string | null) => void,
) => {
  const suggestions = modelSuggestions(draft, models)
  const [active, setActive] = useState(0)

  const selected = Math.min(active, Math.max(0, suggestions.length - 1))

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (suggestions.length === 0) return false
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActive(current => (current + delta + suggestions.length) % suggestions.length)
      return true
    }
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return false
    event.preventDefault()
    choose(suggestions[selected]?.model ?? null)
    return true
  }

  return { suggestions, active: selected, onKeyDown }
}
