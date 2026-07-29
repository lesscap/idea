import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

// The project context a conversation happens in.
//
// Requirements are described against a system that already exists, so the agent
// needs to see it. Every conversation gets its own worktree, branched from the
// repository named by a key. A conversation belongs to a workspace and to no
// single app, so today there is exactly one key — nothing here has to choose.
//
// A worktree is a CACHE. What is durable is the branch it points at; the
// directory can be removed and rebuilt from that branch at any time, which is
// what makes reclaiming disk space safe.

const git = (cwd: string, ...args: string[]) => {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: 'pipe' })
  return {
    ok: result.status === 0,
    out: (result.stdout ?? '').trim(),
    err: (result.stderr ?? '').trim(),
  }
}

// Everything belonging to one repository key, under one directory.
//
// `sessions` is what the agent SDK is pointed at (CLAUDE_CONFIG_DIR). It sits
// beside the worktrees rather than inside them, which is the point: reclaiming a
// worktree — the whole reason a worktree is treated as a cache — must not take
// the agent's memory of the conversation with it. The SDK still separates
// sessions by working directory inside there, so conversations stay isolated
// without us inventing a key.
//
// It also means discarding a key's whole working area is one `rm -rf` rather
// than a hunt through a directory the SDK owns and sweeps on its own schedule.
export type RepoLayout = {
  root: string
  repo: string
  sessions: string
  worktrees: string
}

export const repoLayout = (root: string, repoKey: string): RepoLayout => {
  // The `apps` segment is older than conversations losing their app. It stays:
  // `sessions` below is the one thing here that is NOT a cache, so moving the
  // path would throw away the agent's memory of every conversation on this
  // worker to make a directory name read better.
  const base = join(root, 'apps', repoKey)
  return {
    root: base,
    repo: join(base, 'repo'),
    sessions: join(base, 'claude'),
    worktrees: join(base, 'worktrees'),
  }
}

// A key with no remote still needs somewhere to work, and one that has a remote
// needs it fetched. Both end with a repository at the same path.
//
// The empty case needs one extra step. `git init` alone leaves an unborn HEAD,
// and `ensureWorktree` branches explicitly from `HEAD` — which fails there with
// `fatal: invalid reference: HEAD`, an error that reads like a bug in the caller
// rather than "this repository has no commits".
//
// (Plain `worktree add -b` without a start point does not fail: git 2.51 infers
// `--orphan` instead. That is not what we want — a worktree should start from
// the repository's current state — so the explicit HEAD stays, and an empty
// initial commit gives it something to point at.)
export const ensureRepo = (
  root: string,
  repoKey: string,
  remote: string | null,
): { path: string; created: boolean } => {
  const path = repoLayout(root, repoKey).repo
  if (existsSync(join(path, '.git'))) {
    if (remote) git(path, 'fetch', '--quiet', 'origin')
    return { path, created: false }
  }

  mkdirSync(dirname(path), { recursive: true })

  if (remote) {
    const cloned = spawnSync('git', ['clone', '--quiet', remote, path], { stdio: 'pipe' })
    if (cloned.status !== 0) throw new Error(`could not clone ${remote}: ${cloned.stderr}`)
    return { path, created: true }
  }

  mkdirSync(path, { recursive: true })
  const init = git(path, 'init', '--quiet')
  if (!init.ok) throw new Error(`could not initialise a repository at ${path}: ${init.err}`)
  // Identity is set locally so a machine with no global git config can still
  // commit — a fresh container otherwise fails here with a confusing message.
  git(path, 'config', 'user.email', 'agent@idea.local')
  git(path, 'config', 'user.name', 'idea')
  const first = git(path, 'commit', '--quiet', '--allow-empty', '-m', 'initial')
  if (!first.ok) throw new Error(`could not create the initial commit: ${first.err}`)
  return { path, created: true }
}

export const branchName = (conversationId: number): string => `idea/c${conversationId}`

// Idempotent, and recovers from every state the directory can be left in: gone,
// half-removed, or already there. `git worktree prune` first because a directory
// deleted by hand leaves the repository still believing it exists, and the add
// then fails on a worktree nobody can see.
export const ensureWorktree = (root: string, repoKey: string, conversationId: number): string => {
  const { repo: repoPath, worktrees } = repoLayout(root, repoKey)
  const path = join(worktrees, String(conversationId))
  if (existsSync(path)) return path

  git(repoPath, 'worktree', 'prune')
  mkdirSync(dirname(path), { recursive: true })

  const branch = branchName(conversationId)
  // Re-attaching an existing branch is the ordinary case on rebuild; the work
  // done in earlier turns is on it.
  if (git(repoPath, 'worktree', 'add', path, branch).ok) return path

  const created = git(repoPath, 'worktree', 'add', '-b', branch, path, 'HEAD')
  if (!created.ok)
    throw new Error(
      `could not create a worktree for conversation ${conversationId}: ${created.err}`,
    )
  return path
}
