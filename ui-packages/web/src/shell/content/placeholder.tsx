import type { MessageId } from '../../i18n'
import { useLocale } from '../../i18n'

// Scaffolding, and named so. The layout and the route grammar are what this
// slice is settling; the resources themselves arrive with their models. Keeping
// every stand-in behind one component means there is a single place to delete
// from rather than half-built pages to finish.
export const Placeholder = ({ titleKey, detail }: { titleKey: MessageId; detail?: string }) => {
  const __ = useLocale()

  return (
    <div className="flex flex-col gap-2 p-6" data-testid="placeholder" data-resource={titleKey}>
      <h1 className="font-semibold text-xl">
        {__(titleKey)}
        {detail && <span className="ml-2 text-muted-foreground">{detail}</span>}
      </h1>
      <p className="text-muted-foreground text-sm">{__('shell.placeholder')}</p>
    </div>
  )
}
