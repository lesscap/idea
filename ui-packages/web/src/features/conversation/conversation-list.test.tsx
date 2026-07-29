import { describe, expect, it } from 'vitest'
import { mergeConversations } from './conversation-list'

// The list is ordered by last activity, and that order moves while it is being
// read: saying anything pulls a conversation to the front. So paging through it
// during a live workspace is EXPECTED to overlap, and the overlap must not show
// the same conversation twice — nor move a row the reader is already looking at.
describe('appending a page of conversations', () => {
  const at = (id: number, lastActiveAt: string) => ({ id, title: null, lastActiveAt })

  it('keeps a repeated row in place while taking its newer contents', () => {
    const held = [at(1, 'monday'), at(2, 'tuesday')]
    const next = [at(2, 'friday'), at(3, 'wednesday')]

    expect(mergeConversations(held, next)).toEqual([
      at(1, 'monday'),
      at(2, 'friday'),
      at(3, 'wednesday'),
    ])
  })
})
