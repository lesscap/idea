import type { Id } from '@idea/shared'
import { File, FileText, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { matchPath } from 'react-router-dom'
import { FileResource } from '../features/file/file-resource'
import { RequirementDetail } from '../features/requirement/requirement-detail'
import { RequirementList } from '../features/requirement/requirement-list'
import type { Translate } from '../i18n'

// Every resource the main area can show, in one place. Adding a kind is one
// entry plus one component — this supplies the route pattern, the tab label and
// icon, and the content, so no second copy of a path string exists to drift out
// of step.
//
// TWO RULES for anything registered here:
//
//  1. Content takes its params as props and must NOT read them from the router.
//     Every open tab stays mounted (see ./content), so a background tab calling
//     useParams() receives the *active* tab's params — a wrong value, silently,
//     with nothing throwing.
//
//  2. Content must be a stable module-level component. An inline
//     `Content: () => <X/>` is a fresh component type on every render, which
//     remounts the subtree and throws away exactly the state that keeping tabs
//     mounted was meant to preserve.

export type ResourceParams = Record<string, string | undefined>

export type ResourceContentProps = {
  params: ResourceParams
  appId: Id
  openResource: (ref: string) => void
  showConversation: (cid: string) => void
}

type ResourceDef = {
  /** Route pattern, leading slash included: '/requirements/:code'. */
  path: string
  icon: LucideIcon
  /** Tab and nav label. Takes the translator as an argument because this is data, not a hook. */
  title: (__: Translate, params: ResourceParams) => string
  Content: ComponentType<ResourceContentProps>
}

export const RESOURCES = {
  requirements: {
    path: '/requirements',
    icon: FileText,
    title: __ => __('resource.requirements'),
    Content: RequirementList,
  },
  requirement: {
    path: '/requirements/:code',
    icon: FileText,
    // The code is the label. A real title has to be fetched, and a tab strip
    // whose labels change width after loading is worse than one that reads
    // "R-1" — which is what people say out loud anyway.
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

export type ResourceMatch = {
  kind: ResourceKind
  def: ResourceDef
  params: ResourceParams
}

// Reuses react-router's own matcher rather than hand-written patterns, so a ref
// and a route resolve by identical rules. flatMap over the entries keeps this a
// lookup instead of a growing chain of conditionals.
export const matchResource = (ref: string): ResourceMatch | null =>
  Object.entries(RESOURCES).flatMap(([kind, def]) => {
    const matched = matchPath(def.path, `/${ref}`)
    return matched ? [{ kind: kind as ResourceKind, def, params: matched.params }] : []
  })[0] ?? null
