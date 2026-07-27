import 'dotenv/config'
import { createPrisma } from '../db.ts'

// The agent backends the platform knows how to reach. SAFE TO RUN IN
// PRODUCTION, and safe to run repeatedly — it converges on the target state.
//
//   pnpm --filter @idea/core seed:providers
//
// NOT A SECRET IN SIGHT. `tokenEnv` is the NAME of the environment variable a
// worker will read the credential from; the value never touches this file, this
// database, or the interface where these are configured. Rotating a key is
// editing an environment, not a migration.
//
// `name` is which provider, `kind` is which SDK talks to it. GLM and DeepSeek
// are both `claude` and differ only by endpoint — which is the whole reason one
// adapter serves both, and why these are two columns rather than one.

const PROVIDERS = [
  {
    name: 'glm',
    label: 'GLM 5.2',
    kind: 'claude',
    sortOrder: 0,
    config: {
      baseUrl: 'https://open.bigmodel.cn/api/anthropic',
      model: 'glm-5.2',
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
      tokenEnv: 'IDEA_PROVIDER_DEEPSEEK_TOKEN',
    },
  },
]

const [prisma, dispose] = createPrisma(process.env.DATABASE_URL ?? '')

try {
  for (const provider of PROVIDERS) {
    // Updates label, endpoint and model, and leaves `enabled` alone: turning a
    // provider off is an operational decision, and a deploy should not quietly
    // turn it back on.
    const { name, ...rest } = provider
    await prisma.provider.upsert({
      where: { name },
      update: rest,
      create: { name, ...rest },
    })
    console.log(`  ${name} → ${provider.config.baseUrl} (${provider.config.model})`)
  }
} finally {
  await dispose()
}
