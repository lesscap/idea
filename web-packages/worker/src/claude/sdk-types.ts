// A structural subset of what the agent SDK emits — only the fields the adapter
// actually reads.
//
// Deliberately not the SDK's own message union. Parts of that API are marked
// `@alpha`, and importing the whole shape means every upgrade turns the adapter
// red over variants it never looks at. Narrowing to what is read makes an
// upgrade a question about these eight fields rather than about the SDK.

export type SdkBlock = {
  type: string
  // Present on tool_use, and the key the matching tool_result arrives under.
  id?: string
  name?: string
  input?: unknown
  content?: unknown
  text?: string
  thinking?: string
  tool_use_id?: string
  is_error?: boolean
}

export type SdkMessage = {
  type: string
  message?: { content?: SdkBlock[] }
  subtype?: string
  is_error?: boolean
  result?: string
  // The handle a later turn resumes from. Arrives on the system message, and on
  // the result message when there was no system one.
  session_id?: string
}
