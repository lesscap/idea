import type { App } from '@idea/shared'
import { Activity } from 'react'
import { fileResourceRef } from '../../../features/file/api'
import { useLocale } from '../../../i18n'
import { matchResource } from '../resources'
import type { AppStudioWorkspace } from '../url/use-app-studio-url'

export const ContentColumn = ({ workspace, app }: { workspace: AppStudioWorkspace; app: App }) => {
  const __ = useLocale()
  const { url } = workspace
  const activeMatch = matchResource(url.active)
  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-background"
      data-testid="content-column"
    >
      <div className="relative min-h-0 flex-1">
        {url.tabs.map(ref => {
          const matched = matchResource(ref)
          if (!matched) return null
          const { Content } = matched.def
          return (
            <Activity key={ref} mode={ref === url.active ? 'visible' : 'hidden'} name={ref}>
              <div className="absolute inset-0 overflow-auto">
                <Content
                  params={matched.params}
                  app={app}
                  appId={app.id}
                  openResource={workspace.open}
                  replaceResource={workspace.replace}
                  openFile={file => workspace.open(fileResourceRef(file))}
                  showConversation={workspace.showConversation}
                />
              </div>
            </Activity>
          )
        })}
        {!activeMatch && (
          <p className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            {__('shell.unknownResource', url.active)}
          </p>
        )}
      </div>
    </section>
  )
}
