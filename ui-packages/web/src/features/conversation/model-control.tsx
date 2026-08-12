import type { AgentEffort } from '@idea/shared'
import { Check, ChevronRight, Cpu, RotateCcw } from 'lucide-react'
import { Button } from '../../ui'
import { useLocale } from '../../i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import type { ModelConfiguration } from './use-conversation'

const DEFAULT_MODEL = '__provider_default__'
const AUTO_EFFORT = '__auto__'

export const ModelControl = ({
  configuration,
  disabled,
  onChange,
}: {
  configuration: ModelConfiguration
  disabled: boolean
  onChange: (model: string | null, effort: AgentEffort | null) => Promise<unknown>
}) => {
  const __ = useLocale()
  const model = configuration.model ?? configuration.defaultModel
  const efforts = model === null ? [] : (configuration.efforts[model] ?? [])
  const models = [
    ...new Set(
      [configuration.defaultModel, ...configuration.models, configuration.model].filter(
        (candidate): candidate is string => candidate !== null,
      ),
    ),
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 min-w-0 max-w-48 gap-1.5 px-2 text-muted-foreground text-xs"
          disabled={disabled || model === null}
          data-testid="model-control"
        >
          <Cpu className="size-3.5" />
          <span className="truncate">{model ?? 'Model'}</span>
          {configuration.effort && <span>· {configuration.effort}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          {__('shell.model.label')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={
            configuration.model === null || configuration.model === configuration.defaultModel
              ? DEFAULT_MODEL
              : configuration.model
          }
          onValueChange={value => {
            const nextModel = value === DEFAULT_MODEL ? null : value
            const effectiveModel = nextModel ?? configuration.defaultModel
            const nextEfforts =
              effectiveModel === null ? [] : (configuration.efforts[effectiveModel] ?? [])
            const nextEffort =
              configuration.effort && nextEfforts.includes(configuration.effort)
                ? configuration.effort
                : null
            void onChange(nextModel, nextEffort)
          }}
        >
          {models.map(candidate => (
            <DropdownMenuRadioItem
              key={candidate}
              value={candidate === configuration.defaultModel ? DEFAULT_MODEL : candidate}
            >
              <span className="truncate">{candidate}</span>
              {candidate === configuration.defaultModel && (
                <span className="text-muted-foreground text-xs">{__('shell.model.default')}</span>
              )}
              <DropdownMenuItemIndicator className="absolute right-2">
                <Check />
              </DropdownMenuItemIndicator>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        {efforts.length > 0 && (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {__('shell.model.effort')}
                <span className="ml-auto text-muted-foreground text-xs">
                  {configuration.effort ?? __('shell.model.auto')}
                </span>
                <ChevronRight />
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={configuration.effort ?? AUTO_EFFORT}
                  onValueChange={value =>
                    void onChange(
                      configuration.model,
                      efforts.find(candidate => candidate === value) ?? null,
                    )
                  }
                >
                  {[AUTO_EFFORT, ...efforts].map(candidate => (
                    <DropdownMenuRadioItem key={candidate} value={candidate}>
                      {candidate === AUTO_EFFORT ? __('shell.model.auto') : candidate}
                      <DropdownMenuItemIndicator className="absolute right-2">
                        <Check />
                      </DropdownMenuItemIndicator>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={() => void onChange(null, null)}>
          <RotateCcw />
          {__('shell.model.reset')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
