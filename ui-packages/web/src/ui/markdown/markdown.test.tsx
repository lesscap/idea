import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Markdown } from '.'

const renderDiagram = vi.fn()
vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), render: renderDiagram } }))

beforeEach(() => {
  renderDiagram.mockReset()
  renderDiagram.mockResolvedValue({ svg: '<svg></svg>' })
})

// What is checked here is the wiring, not the libraries. KaTeX's typesetting and
// mermaid's layout are their own problem; whether the plugins are actually in
// the pipeline is ours, and forgetting one fails silently — the formula just
// renders as the literal text someone typed.

describe('maths', () => {
  // Four delimiters, because agents use all of them and remark-math understands
  // only two. `normalizeMath` is what closes that gap.
  it('renders every delimiter an agent might use', () => {
    const { container } = render(
      <Markdown text={'行内 $E=mc^2$ 和 \\(a+b\\)\n\n$$\\int_0^1 x\\,dx$$\n\n\\[\\sum_i a_i\\]'} />,
    )

    expect(container.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(4)
  })

  // Display and inline are not interchangeable: a centred block reads as a
  // statement, the same formula inline reads as an aside.
  it('keeps display maths on its own line', () => {
    const { container } = render(<Markdown text={'先说 $a$\n\n\\[\\sum_i a_i\\]'} />)

    expect(container.querySelectorAll('.katex-display')).toHaveLength(1)
  })

  // A backslash-paren inside a snippet is a regex, not a formula.
  it('leaves maths-like text inside code alone', () => {
    const { container } = render(<Markdown text={'use `f\\(x\\)` here'} />)

    expect(container.querySelector('.katex')).toBeNull()
    expect(container.querySelector('code')?.textContent).toBe('f\\(x\\)')
  })
})

describe('diagrams', () => {
  it('draws a labelled mermaid fence', async () => {
    render(<Markdown text={'```mermaid\ngraph TD\nA --> B\n```'} />)

    await waitFor(() => expect(screen.getByTestId('mermaid-diagram')).toBeInTheDocument())
    expect(renderDiagram).toHaveBeenCalledWith(expect.any(String), 'graph TD\nA --> B')
  })

  // Models forget the label often enough that refusing to draw it would be the
  // visible bug.
  it('draws an unlabelled fence that opens like a flowchart', async () => {
    render(<Markdown text={'```\nflowchart LR\nA --> B\n```'} />)

    await waitFor(() => expect(screen.getByTestId('mermaid-diagram')).toBeInTheDocument())
  })

  // The cost of guessing wrong is someone's code sample turning into a broken
  // picture, so anything that is not unmistakably a diagram stays code.
  it('leaves an ordinary fence as code', async () => {
    const { container } = render(<Markdown text={'```ts\nconst graph = 1\n```'} />)

    await waitFor(() => expect(container.querySelector('pre')).toBeInTheDocument())
    expect(screen.queryByTestId('mermaid-diagram')).toBeNull()
    expect(renderDiagram).not.toHaveBeenCalled()
  })

  // A diagram that will not parse — or a chunk that never arrives — degrades to
  // exactly what it would have been without any of this.
  it('shows the source when it cannot be drawn', async () => {
    renderDiagram.mockRejectedValue(new Error('parse error'))
    render(<Markdown text={'```mermaid\nnot a diagram\n```'} />)

    await waitFor(() =>
      expect(screen.getByTestId('mermaid-source')).toHaveTextContent('not a diagram'),
    )
  })

  // mermaid measures in a scratch element on <body> and abandons it when the
  // parse fails, where it draws itself as a red error graphic at the foot of the
  // page — far enough from the diagram that the cause is not obvious.
  it('does not leave its scratch element behind after a failure', async () => {
    renderDiagram.mockImplementation(async (id: string) => {
      document.body.appendChild(Object.assign(document.createElement('div'), { id: `d${id}` }))
      throw new Error('parse error')
    })
    render(<Markdown text={'```mermaid\nnot a diagram\n```'} />)

    await waitFor(() => expect(screen.getByTestId('mermaid-source')).toBeInTheDocument())
    expect(document.querySelectorAll('[id^=dmermaid-]')).toHaveLength(0)
  })
})

describe('code highlighting', () => {
  it('highlights a labelled code fence', () => {
    const { container } = render(<Markdown text={'```typescript\nconst answer = 42\n```'} />)

    expect(container.querySelector('code')).toHaveClass('hljs', 'language-typescript')
    expect(container.querySelector('.hljs-keyword')).toHaveTextContent('const')
  })
})
