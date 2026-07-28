import { type ComponentProps, isValidElement, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { normalizeMath } from './math'
import { MermaidDiagram } from './mermaid'

// Renders what the agent writes.
//
// Its answers are markdown — headings, lists, emphasis, the occasional table —
// so rendering them as plain text puts literal asterisks in front of someone
// who has never seen markdown and has no reason to.
//
// Business-agnostic, hence `ui/`: it knows nothing about conversations, and
// would drop into another product unchanged.
//
// Maths goes through remark-math + KaTeX, and diagrams through mermaid. Both
// arrive as ordinary markdown, so neither is visible to the caller: the same
// `text` prop grows two more things it knows how to draw.

// Enough to be certain: no language starts a line this way, so the guess cannot
// turn someone's code sample into a broken diagram. Deliberately not widened to
// `sequenceDiagram`, `gantt` or `pie` — those are ordinary words, and a wrong
// guess costs more than an undrawn diagram.
const FLOWCHART = /^(?:graph|flowchart)\s+(?:TB|TD|BT|RL|LR)\b/i

const languageOf = (className?: string) =>
  className
    ?.split(/\s+/)
    .find(name => name.startsWith('language-'))
    ?.slice('language-'.length)

// Models label a diagram most of the time, and forget the rest of the time.
const diagramIn = (className: string | undefined, source: string): string | null => {
  const language = languageOf(className)
  const code = source.replace(/\n$/, '')
  if (language?.toLowerCase() === 'mermaid') return code
  if (language) return null
  return FLOWCHART.test(code.trimStart()) ? code : null
}

// react-markdown gives the fence's language on the inner <code>, so the swap has
// to happen at <pre> — by the time you are inside <code> the wrapper is drawn.
const Pre = ({ children, ...props }: ComponentProps<'pre'>) => {
  if (isValidElement<{ className?: string; children?: ReactNode }>(children)) {
    const diagram = diagramIn(children.props.className, String(children.props.children))
    if (diagram !== null) return <MermaidDiagram source={diagram} />
  }
  return <pre {...props}>{children}</pre>
}

export const Markdown = ({ text }: { text: string }) => (
  <div
    className={[
      'prose prose-sm dark:prose-invert max-w-none break-words',
      // Tightened from the article defaults: this is a chat panel, not a page,
      // and prose's generous vertical rhythm leaves a short answer looking lost.
      'prose-headings:font-semibold prose-headings:text-[0.95em]',
      'prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5',
      'prose-blockquote:my-2 prose-blockquote:not-italic',
      // Descendant selectors rather than prose-* variants: typography drives
      // code colours through CSS variables, which the variants lose to.
      //
      // The foreground is not optional. Typography's `pre` colour is picked for
      // its own dark code block; put a light background under it, as the line
      // below does, and the code becomes grey on grey. Nothing caught it because
      // no answer had happened to contain a fenced block yet.
      '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:border',
      '[&_pre]:border-border [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-xs',
      '[&_pre]:text-foreground [&_pre_code]:bg-transparent [&_pre_code]:text-foreground',
      '[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1',
      '[&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-normal',
      // Typography wraps inline code in backticks via pseudo-elements.
      'prose-code:before:hidden prose-code:after:hidden',
      // A long equation scrolls sideways rather than widening the panel, same
      // rule as the table below.
      '[&_.katex-display]:my-2 [&_.katex-display]:overflow-x-auto',
      '[&_.katex-display]:overflow-y-hidden',
      // A wide table scrolls inside the panel rather than stretching it and
      // making the whole conversation scroll sideways.
      '[&_table]:block [&_table]:w-max [&_table]:max-w-full [&_table]:overflow-x-auto',
    ].join(' ')}
    data-testid="markdown"
  >
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        pre: Pre,
        // The transcript is the application; a link should not navigate away
        // from a conversation someone is in the middle of.
        a: ({ node: _node, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer" />
        ),
      }}
    >
      {normalizeMath(text)}
    </ReactMarkdown>
  </div>
)
