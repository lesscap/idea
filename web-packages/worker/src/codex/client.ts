import { Codex } from '@openai/codex-sdk'
import { agentEnv } from '../agent/env.ts'

export const createCodexClient = (codexHome: string) =>
  new Codex({
    env: agentEnv({ CODEX_HOME: codexHome }),
    // Built-in provider ids cannot be overridden. This equivalent provider
    // keeps ChatGPT authentication and the Codex Responses endpoint, while
    // declaring the one capability the current network path cannot carry.
    config: {
      model_provider: 'idea-openai',
      model_providers: {
        'idea-openai': {
          name: 'OpenAI',
          base_url: 'https://chatgpt.com/backend-api/codex',
          wire_api: 'responses',
          requires_openai_auth: true,
          supports_websockets: false,
        },
      },
    },
  })
