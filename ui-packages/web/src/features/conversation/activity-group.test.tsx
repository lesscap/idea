import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LocaleProvider } from '../../i18n'
import type { ActivityGroup } from './activity'
import { ActivityBlock } from './activity-group'

describe('the activity disclosure', () => {
  it('keeps failure and running state in its accessible name', () => {
    const group: ActivityGroup = {
      kind: 'activity-group',
      key: 'group:a',
      live: true,
      items: [
        {
          kind: 'tool',
          key: 'a',
          name: 'Read',
          input: {},
          running: false,
          failed: true,
        },
        { kind: 'thinking', key: 'b', text: 'checking the result' },
      ],
    }

    render(
      <LocaleProvider>
        <ActivityBlock group={group} />
      </LocaleProvider>,
    )

    expect(screen.getByTestId('activity-toggle')).toHaveAccessibleName(/2 步.*1 失败.*运行中/)
  })
})
