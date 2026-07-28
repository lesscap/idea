import { useEffect, useId, useState } from 'react'

// A diagram, drawn from a fenced block the model wrote.
//
// Two states, not three. Until there is an SVG the source is shown as the code
// block it already is — which is exactly what this file being absent would give
// you. So a diagram that fails to render, or a library chunk that never arrives,
// degrades to something readable rather than to a spinner or an apology.
//
// That is also what keeps this component free of copy, and therefore free of
// i18n — which ui/ is not allowed to import anyway.

const domId = (id: string) => `mermaid-${id.replace(/[^a-zA-Z0-9-]/g, '')}`

export const MermaidDiagram = ({ source }: { source: string }) => {
  const id = useId()
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    // mermaid measures in a scratch element appended to <body>, named `d` +
    // whatever id it was given. It removes it on success and leaves it behind on
    // failure — where it renders as a red "Syntax error" graphic at the bottom
    // of the page, nowhere near the block that caused it.
    const sweep = () => document.getElementById(`d${domId(id)}`)?.remove()

    const draw = async () => {
      try {
        // 3.5 MB, in its own chunk, fetched the first time a diagram appears and
        // never on a conversation that has none.
        const { default: mermaid } = await import('mermaid')
        mermaid.initialize({
          startOnLoad: false,
          // The text in a diagram comes from the model, and the model is reading
          // what a person typed. `strict` encodes labels and disables click
          // handlers, which is what makes the SVG safe to insert below.
          securityLevel: 'strict',
          htmlLabels: false,
          // The same signal styles.css uses. Nothing sets `.dark` yet, so this
          // resolves to the light theme today and follows along when a toggle
          // lands.
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
        })
        const drawn = await mermaid.render(domId(id), source)
        if (active) setSvg(drawn.svg)
      } catch {
        sweep()
        // Deliberately not clearing a previous render. A streamed diagram is
        // invalid until its last line arrives, and flashing back to source on
        // every frame is worse than showing the last thing that parsed.
      }
    }

    void draw()
    return () => {
      active = false
      // Also on the way out: unmounting mid-render leaves the same orphan.
      sweep()
    }
  }, [id, source])

  if (svg === null)
    return (
      <pre data-testid="mermaid-source">
        <code>{source}</code>
      </pre>
    )

  return (
    <div
      role="img"
      data-testid="mermaid-diagram"
      className="my-2 overflow-x-auto rounded border border-border bg-muted/40 p-3 [&_svg]:h-auto [&_svg]:max-w-none"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: an SVG string from mermaid's own renderer, not markup out of the document
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
