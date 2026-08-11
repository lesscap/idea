import type { Id, RequirementContent, RequirementDetail, RequirementRevision } from '@idea/shared'
import { useEffect, useRef, useState } from 'react'
import { getRequirement, getRequirementByCode, getRequirementRevision } from '../api'
import type { RequirementVersionSelection } from './version-menu'

export type DetailState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly value: RequirementDetail }
  | { readonly status: 'failed' }

export type RevisionState =
  | { readonly status: 'loading'; readonly revisionId: Id }
  | { readonly status: 'ready'; readonly revisionId: Id; readonly value: RequirementRevision }
  | { readonly status: 'failed'; readonly revisionId: Id }

export type SelectedContent =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready'
      readonly value: RequirementContent
      readonly sourceCid: string | null
    }
  | { readonly status: 'failed'; readonly revisionId: Id }
  | { readonly status: 'unavailable' }

export const initialSelection = (
  requirement: RequirementDetail,
): RequirementVersionSelection | null =>
  requirement.draft
    ? { kind: 'draft' }
    : requirement.currentRevision
      ? { kind: 'revision', id: requirement.currentRevision.id }
      : null

export const selectedContent = (
  requirement: RequirementDetail,
  selection: RequirementVersionSelection | null,
  revision: RevisionState | null,
): SelectedContent => {
  if (!selection) return { status: 'unavailable' }
  if (selection.kind === 'draft') {
    return requirement.draft
      ? {
          status: 'ready',
          value: requirement.draft,
          sourceCid: requirement.draft.updatedInConversationCid,
        }
      : { status: 'unavailable' }
  }
  if (selection.id === requirement.currentRevision?.id) {
    return {
      status: 'ready',
      value: requirement.currentRevision,
      sourceCid: requirement.currentRevision.confirmedInConversationCid,
    }
  }
  if (!revision || revision.revisionId !== selection.id || revision.status === 'loading') {
    return { status: 'loading' }
  }
  if (revision.status === 'failed') return { status: 'failed', revisionId: selection.id }
  return {
    status: 'ready',
    value: revision.value,
    sourceCid: revision.value.confirmedInConversationCid,
  }
}

export const useRequirementDetailState = (appId: Id, code: string) => {
  const requestRef = useRef<{ readonly attempt: number } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<DetailState>({ status: 'loading' })
  const [selection, setSelection] = useState<RequirementVersionSelection | null>(null)
  const [revision, setRevision] = useState<RevisionState | null>(null)

  useEffect(() => {
    const request = { attempt }
    requestRef.current = request
    setState({ status: 'loading' })
    setSelection(null)
    setRevision(null)

    getRequirementByCode(appId, code)
      .then(identity => getRequirement(appId, identity.id))
      .then(
        requirement => {
          if (requestRef.current !== request) return
          setState({ status: 'ready', value: requirement })
          setSelection(initialSelection(requirement))
        },
        () => {
          if (requestRef.current === request) setState({ status: 'failed' })
        },
      )

    return () => {
      if (requestRef.current === request) requestRef.current = null
    }
  }, [appId, attempt, code])

  const requirement = state.status === 'ready' ? state.value : null
  const requirementId = requirement?.id ?? null
  const currentRevisionId = requirement?.currentRevision?.id ?? null

  useEffect(() => {
    const historicalRevisionId =
      selection?.kind === 'revision' && selection.id !== currentRevisionId ? selection.id : null
    if (requirementId === null || historicalRevisionId === null) {
      setRevision(null)
      return
    }

    let active = true
    setRevision({ status: 'loading', revisionId: historicalRevisionId })
    getRequirementRevision(appId, requirementId, historicalRevisionId).then(
      value => {
        if (active) setRevision({ status: 'ready', revisionId: historicalRevisionId, value })
      },
      () => {
        if (active) setRevision({ status: 'failed', revisionId: historicalRevisionId })
      },
    )

    return () => {
      active = false
    }
  }, [appId, currentRevisionId, requirementId, selection])

  const content = requirement
    ? selectedContent(requirement, selection, revision)
    : ({ status: 'unavailable' } as const)

  const retryRevision = () => {
    if (content.status === 'failed') {
      setSelection({ kind: 'revision', id: content.revisionId })
    }
  }

  return {
    state,
    selection,
    content,
    selectVersion: setSelection,
    retryDetail: () => setAttempt(value => value + 1),
    retryRevision,
  }
}
