import { describe, expect, it } from 'vitest'
import { modelSuggestions, parseModelCommand } from './model-command'

describe('/model', () => {
  it('accepts arbitrary models and a supported effort', () => {
    expect(parseModelCommand('/model future-model high')).toEqual({
      kind: 'apply',
      model: 'future-model',
      effort: 'high',
    })
  })

  it('resets when no model is supplied and rejects unknown effort', () => {
    expect(parseModelCommand('/model')).toEqual({ kind: 'reset' })
    expect(parseModelCommand('/model gpt-5.6-sol ultra')).toEqual({ kind: 'invalid' })
  })

  it('uses provider models as hints rather than a whitelist', () => {
    expect(modelSuggestions('/model terra', ['gpt-5.6-sol', 'gpt-5.6-terra'])).toEqual([
      { label: '/model gpt-5.6-terra', model: 'gpt-5.6-terra' },
    ])
  })
})
