import { Languages } from 'lucide-react'
import { LOCALE_NAMES, type Locale, storeLocale, useLocaleControl } from '../i18n/index.tsx'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/index.ts'

// Standalone control, used on the login screen. Signed-in users switch from the
// account menu instead — but the login screen needs its own, or someone who
// cannot read the current language has no way in.
export const LocaleSwitch = () => {
  const { locale, setLocale, available } = useLocaleControl()

  const choose = (next: Locale) => {
    setLocale(next)
    storeLocale(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          data-testid="locale-switch"
        >
          <Languages />
          {LOCALE_NAMES[locale]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {available.map(code => (
          <DropdownMenuItem key={code} data-testid={`locale-${code}`} onSelect={() => choose(code)}>
            {LOCALE_NAMES[code]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
