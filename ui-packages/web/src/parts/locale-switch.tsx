import { Check, ChevronRight, Languages } from 'lucide-react'
import { useSaveLocale } from '../core/session/use-session'
import { LOCALE_NAMES, type Locale, storeLocale, useLocale, useLocaleControl } from '../i18n'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../ui'

// Writes to both places, and they are not redundant:
//   localStorage — covers signed-out visitors, who have no account to attach a
//                  preference to, and gives the login screen its language before
//                  any request has been made
//   the account  — follows the user to another browser or machine
const useLocaleChoice = () => {
  const { locale, setLocale, available } = useLocaleControl()
  const saveLocale = useSaveLocale()

  const choose = (next: Locale) => {
    setLocale(next)
    storeLocale(next)
    // Fire and forget: the interface has already switched, and failing to
    // persist a language preference is not worth interrupting anyone over.
    void saveLocale(next).catch(err => console.error('could not save locale', err))
  }

  return { locale, available, choose }
}

// The login screen keeps a standalone switch so users can choose a language
// before they have an account menu.
export const LocaleSwitch = () => {
  const __ = useLocale()
  const { locale, available, choose } = useLocaleChoice()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground"
          data-testid="locale-switch"
          aria-label={__('common.language')}
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

export const LocaleMenu = () => {
  const __ = useLocale()
  const { locale, available, choose } = useLocaleChoice()

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger data-testid="menu-language">
        <Languages />
        {__('common.language')}
        <span className="ml-auto text-muted-foreground text-xs">{LOCALE_NAMES[locale]}</span>
        <ChevronRight />
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent sideOffset={4}>
        {available.map(code => (
          <DropdownMenuItem key={code} data-testid={`locale-${code}`} onSelect={() => choose(code)}>
            {LOCALE_NAMES[code]}
            {locale === code && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
