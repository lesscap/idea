import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { appLayout, branchName, ensureRepo, ensureWorktree } from './worktree.ts'

// Real git in a temporary directory. Stubbing it would test that we call the
// commands we think we call, while every failure worth catching here is git
// disagreeing with that belief — which is what happened while writing this.

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'idea-worktree-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim()

describe('a repository for an app with no remote', () => {
  // The one that bites: `git init` leaves an unborn HEAD, and branching a
  // worktree from HEAD there fails with `invalid reference: HEAD` — which reads
  // as a caller bug rather than "this repository has no commits".
  it('has a commit to branch from', () => {
    const repo = ensureRepo(root, 'app-1', null)

    expect(git(repo.path, 'rev-parse', '--verify', 'HEAD')).toMatch(/^[0-9a-f]{40}$/)
  })

  it('is reused rather than recreated', () => {
    const first = ensureRepo(root, 'app-1', null)
    writeFileSync(join(first.path, 'marker.txt'), 'still here')

    const second = ensureRepo(root, 'app-1', null)

    expect(second.created).toBe(false)
    expect(existsSync(join(second.path, 'marker.txt'))).toBe(true)
  })

  // A machine with no global git identity — a fresh container — otherwise fails
  // at the initial commit with a message about telling git who you are.
  it('commits without a global git identity', () => {
    expect(() => ensureRepo(root, 'app-2', null)).not.toThrow()
  })
})

describe('a worktree for a conversation', () => {
  const app = 'app-1'
  const repo = () => ensureRepo(root, app, null).path

  it('is created on its own branch', () => {
    repo()
    const path = ensureWorktree(root, app, 7)

    expect(existsSync(path)).toBe(true)
    expect(git(path, 'branch', '--show-current')).toBe(branchName(7))
  })

  // The reason sessions live beside the worktrees rather than inside one: the
  // worktree is a cache and gets reclaimed, and the agent's memory of the
  // conversation must not go with it.
  it('keeps the session directory outside every worktree', () => {
    repo()
    const worktree = ensureWorktree(root, app, 7)
    const { sessions } = appLayout(root, app)

    expect(worktree.startsWith(sessions)).toBe(false)
    expect(sessions.startsWith(worktree)).toBe(false)
  })

  it('survives its worktree being deleted', () => {
    repo()
    const { sessions } = appLayout(root, app)
    mkdirSync(sessions, { recursive: true })
    writeFileSync(join(sessions, 'session.jsonl'), 'remembered')

    rmSync(ensureWorktree(root, app, 7), { recursive: true, force: true })

    expect(existsSync(join(sessions, 'session.jsonl'))).toBe(true)
  })

  it('gives separate conversations separate directories', () => {
    repo()

    expect(ensureWorktree(root, app, 7)).not.toBe(ensureWorktree(root, app, 8))
  })

  // The property that makes reclaiming disk space safe: the branch is durable,
  // the directory is a cache. Note the file written below is NOT expected back —
  // uncommitted work is part of what the cache holds.
  it('is rebuilt from its branch after the directory is deleted', () => {
    repo()
    const first = ensureWorktree(root, app, 7)
    execFileSync('git', ['-C', first, 'commit', '--allow-empty', '-m', 'from an earlier turn'], {
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'a',
        GIT_AUTHOR_EMAIL: 'a@b',
        GIT_COMMITTER_NAME: 'a',
        GIT_COMMITTER_EMAIL: 'a@b',
      },
    })
    rmSync(first, { recursive: true, force: true })

    const rebuilt = ensureWorktree(root, app, 7)

    expect(existsSync(rebuilt)).toBe(true)
    // Back on the same branch, with the earlier turn's commit still on it.
    expect(git(rebuilt, 'branch', '--show-current')).toBe(branchName(7))
    expect(git(rebuilt, 'log', '-1', '--format=%s')).toBe('from an earlier turn')
  })

  it('does nothing when the worktree is already there', () => {
    repo()
    const path = ensureWorktree(root, app, 7)
    writeFileSync(join(path, 'draft.txt'), 'half-finished')

    expect(ensureWorktree(root, app, 7)).toBe(path)
    expect(existsSync(join(path, 'draft.txt'))).toBe(true)
  })
})
