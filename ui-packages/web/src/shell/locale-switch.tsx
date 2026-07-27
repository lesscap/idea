import { Languages } from 'lucide-react'
import { useSaveLocale } from '../core/session/use-session.ts'
import { LOCALE_NAMES, type Locale, storeLocale, useLocaleControl } from '../i18n/index.tsx'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/index.ts'

// Used both in the header, next to the avatar, and on the login screen. It was
// briefly a submenu inside the account menu, which buried a one-click choice two
// levels deep — and the login screen needs it regardless, or someone who cannot
// read the current language has no way in.
//
// Writes to both places, and they are not redundant:
//   localStorage — covers signed-out visitors, who have no account to attach a
//                  preference to, and gives the login screen its language before
//                  any request has been made
//   the account  — follows the user to another browser or machine
export const LocaleSwitch = () => {
  const { locale, setLocale, available } = useLocaleControl()
  const saveLocale = useSaveLocale()

  const choose = (next: Locale) => {
    setLocale(next)
    storeLocale(next)
    // Fire and forget: the interface has already switched, and failing to
    // persist a language preference is not worth interrupting anyone over.
    void saveLocale(next).catch(err => console.error('could not save locale', err))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground"
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
