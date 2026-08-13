import { cn } from '../../lib/cn'

export const BrandMark = ({ compact = false }: { compact?: boolean }) => (
  <div className="flex min-w-0 items-center gap-2" aria-label="idea" role="img">
    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand text-brand-foreground">
      <span className="size-2.5 rounded-full bg-current" />
    </span>
    {!compact && <span className={cn('truncate font-semibold text-[15px]')}>idea</span>}
  </div>
)
