import type { App, Id } from '@idea/shared'
import { File, FileText, House, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { matchPath } from 'react-router-dom'
import { AppOverview } from '../../features/app/app-overview'
import type { FileDescriptor } from '../../features/file/api'
import { FileResource } from '../../features/file/file-resource'
import { RequirementDetail } from '../../features/requirement/detail'
import { RequirementList } from '../../features/requirement/requirement-list'
import type { Translate } from '../../i18n'

export type ResourceParams = Record<string, string | undefined>
export type ResourceContentProps = {
  params: ResourceParams
  app: App
  appId: Id
  openResource: (ref: string) => void
  openFile: (file: FileDescriptor) => void
  showConversation: (cid: string) => void
}
type ResourceDef = {
  path: string
  icon: LucideIcon
  title: (__: Translate, params: ResourceParams) => string
  Content: ComponentType<ResourceContentProps>
}

export const RESOURCES = {
  overview: {
    path: '/overview',
    icon: House,
    title: __ => __('resource.overview'),
    Content: AppOverview,
  },
  requirements: {
    path: '/requirements',
    icon: FileText,
    title: __ => __('resource.requirements'),
    Content: RequirementList,
  },
  requirement: {
    path: '/requirements/:code',
    icon: FileText,
    title: (_, params) => params.code ?? '',
    Content: RequirementDetail,
  },
  file: {
    path: '/files/:fid/*',
    icon: File,
    title: (_, params) => params['*'] ?? '',
    Content: FileResource,
  },
} satisfies Record<string, ResourceDef>

export type ResourceKind = keyof typeof RESOURCES
export type ResourceMatch = { kind: ResourceKind; def: ResourceDef; params: ResourceParams }
export const matchResource = (ref: string): ResourceMatch | null =>
  Object.entries(RESOURCES).flatMap(([kind, def]) => {
    const matched = matchPath(def.path, `/${ref}`)
    return matched ? [{ kind: kind as ResourceKind, def, params: matched.params }] : []
  })[0] ?? null
