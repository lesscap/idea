import 'dotenv/config'
import { parseArgs } from 'node:util'
import { hashPassword } from '../crypto.ts'
import { createPrisma } from '../db.ts'

// Ensures an administrator exists. SAFE TO RUN IN PRODUCTION, and safe to run
// repeatedly — it converges on the target state rather than assuming a blank
// database.
//
// Bootstrapping needs this: access is invite-only, invites can only be created
// by an admin of an existing workspace, so without a first admin in a first
// workspace there is no way into the system at all.
//
//   pnpm --filter @idea/core seed:admin \
//     --username admin --password '...' --workspace 'Default' [--name '管理员']
//
// Idempotency rules, and one deliberate exception:
//
//   user missing      -> created with the given password
//   user exists       -> PASSWORD IS LEFT ALONE
//   not platform admin-> granted
//   workspace missing -> created
//   workspace exists  -> joined (not duplicated)
//   not a member      -> added as admin
//   member, not admin -> promoted to admin
//
// The password exception is the important one. "Converge on the target state"
// would mean resetting it on every run, and a deploy pipeline that quietly
// restores an operator's password to whatever is in a script — or in shell
// history — is worse than a seed that does slightly less than it promises.
// Rotating a password is a separate, deliberate act.

const { values } = parseArgs({
  options: {
    username: { type: 'string' },
    password: { type: 'string' },
    workspace: { type: 'string' },
    name: { type: 'string' },
  },
})

const { username, password, workspace, name } = values

if (!username || !password || !workspace) {
  console.error('usage: seed:admin --username <u> --password <p> --workspace <w> [--name <n>]')
  process.exit(1)
}

// Deliberately not using normalizeUsername from @idea/shared: core must not
// depend on shared for one function, and this path is for operators, who are
// trusted. It is also how a reserved name like "admin" gets created at all —
// reserved means "not available through registration", not "never exists".
const normalized = username.trim().toLowerCase()

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const [prisma, disconnect] = createPrisma(url)
const done: string[] = []

try {
  await prisma.$transaction(async tx => {
    let user = await tx.user.findUnique({ where: { username: normalized } })

    if (user) {
      done.push(`user "${normalized}" already exists (password unchanged)`)
    } else {
      user = await tx.user.create({
        data: {
          username: normalized,
          name: name ?? normalized,
          passwordHash: hashPassword(password),
        },
      })
      done.push(`created user "${normalized}"`)
    }

    const admin = await tx.platformAdmin.findUnique({ where: { userId: user.id } })
    if (admin) {
      done.push('already a platform admin')
    } else {
      await tx.platformAdmin.create({ data: { userId: user.id } })
      done.push('granted platform admin')
    }

    // Joins a workspace of that name rather than creating a second one beside
    // it. Workspace names are deliberately not globally unique — two customers
    // may both have a "Design" team — but that rule is about tenants, and
    // re-running this should not leave duplicates behind.
    const existing = await tx.workspace.findFirst({ where: { name: workspace } })
    const ws = existing ?? (await tx.workspace.create({ data: { name: workspace } }))
    done.push(`${existing ? 'joined existing' : 'created'} workspace "${ws.name}" (id ${ws.id})`)

    const membership = await tx.userWorkspace.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId: ws.id } },
    })

    if (!membership) {
      await tx.userWorkspace.create({
        data: { userId: user.id, workspaceId: ws.id, role: 'admin' },
      })
      done.push('added as workspace admin')
    } else if (membership.role !== 'admin') {
      await tx.userWorkspace.update({
        where: { userId_workspaceId: { userId: user.id, workspaceId: ws.id } },
        data: { role: 'admin' },
      })
      done.push('promoted to workspace admin')
    } else {
      done.push('already workspace admin')
    }
  })

  for (const line of done) console.log(`  ${line}`)
} finally {
  await disconnect()
}
