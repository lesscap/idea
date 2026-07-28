#!/usr/bin/env node
// Drives a whole conversation over the real HTTP surface — no browser involved.
//
// This exists because "the model answered" and "the interface rendered it" are
// different claims, and finding out which one broke is much easier when they can
// be checked apart. Everything below the interface is exercised here: sign-in,
// creating a conversation, sending, the worker claiming and running a turn, and
// the transcript coming back.
//
//   scripts/conversation.mjs                            one turn, default account
//   scripts/conversation.mjs "我要一个报销审批系统"        with your own message
//   scripts/conversation.mjs --conversation 12 "还要能导出" continue an existing one
//
// A worker must be running and enrolled in the same workspace, or the message
// will sit queued and this will time out saying so.

const args = process.argv.slice(2)
const flag = name => {
  const at = args.indexOf(`--${name}`)
  if (at === -1) return undefined
  const [value] = args.splice(at, 2).slice(1)
  return value
}

const server = flag('server') ?? process.env.IDEA_SERVER ?? 'http://localhost:3300'
const username = flag('user') ?? 'admin'
const password = flag('password') ?? 'admin@2026'
const conversationId = flag('conversation')
const waitSeconds = Number(flag('wait') ?? 120)
const message = args.join(' ') || '我想做一个报销审批的系统'

const WEB = `${server}/api/web`
let cookie = ''

const call = async (path, init = {}) => {
  const response = await fetch(`${WEB}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...init.headers },
  })
  const setCookie = response.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  const body = await response.json().catch(() => null)
  if (body?.success !== true)
    throw new Error(`${path} → ${response.status} ${body?.message ?? response.statusText}`)
  return body.data
}

const post = (path, body) =>
  call(path, { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) })

const line = stored => {
  const event = stored.event
  const at = `#${String(stored.sequence).padStart(2)}`
  if (event.type === 'user_message') return `${at} 我   ${event.text}`
  if (event.type === 'item.completed' && event.item.type === 'agent_message')
    return `${at} 助手 ${event.item.text}`
  if (event.type === 'item.completed' && event.item.type === 'reasoning')
    return `${at} …    (思考 ${event.item.text.length} 字)`
  if (event.type === 'item.started') return `${at} 工具 ${event.item.name ?? event.item.type} …`
  if (event.type === 'turn.failed') return `${at} 失败 ${event.error.message}`
  return `${at} ${event.type}`
}

await post('/session', { username, password })

const conversation = conversationId
  ? { id: Number(conversationId) }
  : await post('/conversations', { text: message })

process.stdout.write(`conversation ${conversation.id} ← ${message}\n\n`)

// Where this run starts. Continuing a conversation means the transcript already
// ends in a completed turn, and watching from the beginning would see that one
// and declare victory before the new answer had even begun.
const before = await call(`/conversations/${conversation.id}/events`)
let seen = conversationId ? (before.items.at(-1)?.sequence ?? -1) : -1

if (conversationId) {
  const sent = await post(`/conversations/${conversation.id}/messages`, { text: message })
  if (!sent.started)
    process.stdout.write('(a turn was already running — this will merge into the next one)\n')
}

// Polling rather than the event stream: this script is the check that the
// plumbing works, so it should depend on as little of it as possible.
const deadline = Date.now() + waitSeconds * 1000
let settled = false

while (Date.now() < deadline && !settled) {
  const { items } = await call(`/conversations/${conversation.id}/events`)
  for (const stored of items) {
    if (stored.sequence <= seen) continue
    seen = stored.sequence
    process.stdout.write(`${line(stored)}\n`)
    if (['turn.completed', 'turn.failed', 'turn.aborted'].includes(stored.event.type))
      settled = true
  }
  if (!settled) await new Promise(resolve => setTimeout(resolve, 700))
}

if (!settled) {
  process.stdout.write(
    `\nnothing finished within ${waitSeconds}s — is a worker running and enrolled in this workspace?\n`,
  )
  process.exit(1)
}

// Free with every run: the provider's raw payload can carry an environment dump
// or a credential passed as a tool argument, and it must not leave the server.
const { items } = await call(`/conversations/${conversation.id}/events`)
const leaked = JSON.stringify(items).includes('"raw"')
process.stdout.write(`\nraw payload in the response: ${leaked ? 'LEAKED' : 'none'}\n`)
if (leaked) process.exit(1)
