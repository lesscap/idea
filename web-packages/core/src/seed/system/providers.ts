import 'dotenv/config'
import { createPrisma } from '../../db.ts'

// Built-in agent backends. Safe to run in production and repeatedly: labels,
// endpoints and models converge, while the operational `enabled` flag is left
// alone.
//
//   pnpm --filter @idea/core seed:system
//   pnpm --filter @idea/core seed:providers  # compatibility alias

const PROVIDERS = [
  {
    name: 'glm',
    label: 'GLM 5.2',
    kind: 'claude',
    sortOrder: 0,
    config: {
      baseUrl: 'https://open.bigmodel.cn/api/anthropic',
      model: 'glm-5.2',
      efforts: { 'glm-5.2': [] },
      tokenEnv: 'IDEA_PROVIDER_GLM_TOKEN',
    },
  },
  {
    name: 'deepseek',
    label: 'DeepSeek',
    kind: 'claude',
    sortOrder: 1,
    config: {
      baseUrl: 'https://api.deepseek.com/anthropic',
      model: 'deepseek-v4-pro[1m]',
      efforts: { 'deepseek-v4-pro[1m]': [] },
      tokenEnv: 'IDEA_PROVIDER_DEEPSEEK_TOKEN',
    },
  },
  {
    name: 'codex',
    label: 'Codex',
    kind: 'codex',
    sortOrder: 2,
    config: {
      model: 'gpt-5.6-sol',
      models: ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'],
      efforts: {
        'gpt-5.6-sol': ['minimal', 'low', 'medium', 'high', 'xhigh'],
        'gpt-5.6-terra': ['minimal', 'low', 'medium', 'high', 'xhigh'],
        'gpt-5.6-luna': ['minimal', 'low', 'medium', 'high', 'xhigh'],
      },
    },
  },
]

const [prisma, dispose] = createPrisma(process.env.DATABASE_URL ?? '')

try {
  for (const provider of PROVIDERS) {
    const { name, ...rest } = provider
    await prisma.provider.upsert({
      where: { name },
      update: rest,
      create: { name, ...rest },
    })
    console.log(`  ${name} → ${provider.config.model}`)
  }
} finally {
  await dispose()
}
