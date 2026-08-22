import type { App, Id } from '@idea/shared'
import { CircleDot, File, House, Plus, Tag, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { matchPath } from 'react-router-dom'
import { AppOverview } from '../../features/app/app-overview'
import type { FileDescriptor } from '../../features/file/api'
import { FileResource } from '../../features/file/file-resource'
import { IssueDetail } from '../../features/issue/issue-detail'
import { IssueList } from '../../features/issue/issue-list'
import { LabelManager } from '../../features/issue/label-manager'
import { NewIssue } from '../../features/issue/new-issue'
import type { Translate } from '../../i18n'

export type ResourceParams = Record<string, string | undefined>
export type ResourceContentProps = {
  params: ResourceParams
  app: App
  appId: Id
  openResource: (ref: string) => void
  replaceResource: (ref: string) => void
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
  issues: {
    path: '/issues',
    icon: CircleDot,
    title: __ => __('resource.issues'),
    Content: IssueList,
  },
  newIssue: {
    path: '/issues/new',
    icon: Plus,
    title: __ => __('issue.new'),
    Content: NewIssue,
  },
  labels: {
    path: '/issues/labels',
    icon: Tag,
    title: __ => __('issue.manageLabels'),
    Content: LabelManager,
  },
  issue: {
    path: '/issues/:number',
    icon: CircleDot,
    title: (_, params) => (params.number ? `#${params.number}` : ''),
    Content: IssueDetail,
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
