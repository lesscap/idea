import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Renders what the agent writes.
//
// Its answers are markdown — headings, lists, emphasis, the occasional table —
// so rendering them as plain text puts literal asterisks in front of someone
// who has never seen markdown and has no reason to.
//
// Business-agnostic, hence `ui/`: it knows nothing about conversations, and
// would drop into another product unchanged.
//
// Maths and diagrams are NOT here yet. Both need their own plugin and their own
// styling decisions (KaTeX brings a stylesheet; mermaid renders asynchronously
// and has to be given a size), which is a slice of its own. This component is
// where they will attach.
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
      '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:border',
      '[&_pre]:border-border [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-xs',
      '[&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1',
      '[&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-normal',
      // Typography wraps inline code in backticks via pseudo-elements.
      'prose-code:before:hidden prose-code:after:hidden',
      // A wide table scrolls inside the panel rather than stretching it and
      // making the whole conversation scroll sideways.
      '[&_table]:block [&_table]:w-max [&_table]:max-w-full [&_table]:overflow-x-auto',
    ].join(' ')}
    data-testid="markdown"
  >
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // The transcript is the application; a link should not navigate away
        // from a conversation someone is in the middle of.
        a: ({ node: _node, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer" />
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  </div>
)
