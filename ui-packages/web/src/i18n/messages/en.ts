import type { zh } from './zh.ts'

// Typed against zh, so omitting a message or misspelling a key fails to
// compile. No reconciliation script needed — the type checker is the check.
export const en: typeof zh = {
  common: {
    cancel: 'Cancel',
    confirm: 'Confirm',
    close: 'Close',
    loading: 'Loading…',
    copy: 'Copy link',
    done: 'Done',
    retry: 'Retry',
    language: 'Language',
  },

  auth: {
    signInTitle: 'Sign in to idea',
    username: 'Username',
    password: 'Password',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    signOut: 'Sign out',
    signInFailed: 'Incorrect username or password',
  },

  invite: {
    title: 'Invite a member',
    description:
      'Generate a link and send it to them. It carries no identity — whoever holds it can use it, once.',
    generate: 'Generate invite link',
    generating: 'Generating…',
    copyNow: 'Copy it now. This link cannot be shown again after closing.',
    failed: 'Could not generate an invite',
    invalid: 'This invitation is not valid',
    invalidHint:
      'It may have been used already, expired, or been mistyped. Ask whoever invited you for a new link.',
    checking: 'Checking invitation…',
    joinTitle: 'Join “{0}”',
    invitedBy: '{0} invited you to this workspace',
    signedInAs: 'Signed in as {0} — you will join with this account.',
    name: 'Name',
    usernameHint: 'For signing in. Lowercase letters, digits, and . _ -',
    passwordHint: 'At least 8 characters',
    phone: 'Phone (optional)',
    phoneHint: 'Used later for password recovery',
    join: 'Join',
    registerAndJoin: 'Create account and join',
    processing: 'Working…',
    acceptFailed: 'Could not accept the invitation',
    usernameTaken: 'That username is taken',
  },

  workspace: {
    noneTitle: 'You are not in any workspace yet',
    noneHint: 'Ask an administrator to invite you. Opening their link brings you in.',
    admin: 'Admin',
    member: 'Member',
  },

  app: {
    heading: 'Apps',
    create: 'New app',
    creating: 'Creating…',
    empty: 'No apps yet',
    name: 'Name',
    namePlaceholder: 'e.g. Expense approval',
    description: 'Description (optional)',
    descriptionPlaceholder: 'Who is it for, and what problem does it solve',
    createdAt: 'Created {0}',
    status: {
      draft: 'Draft',
      active: 'Active',
      archived: 'Archived',
    },
    error: {
      conflict: 'An app with that name already exists',
      forbidden: 'You do not have permission to do that',
      not_found: 'App not found',
      fallback: 'Could not create the app',
    },
  },

  error: {
    unauthorized: 'Your session expired — please sign in again',
    forbidden: 'You do not have permission to do that',
    not_found: 'Not found',
    conflict: 'That conflicts with the current state',
    bad_request: 'Invalid request',
    internal: 'Something went wrong — please try again',
    network: 'Network problem — check your connection',
    fallback: 'That did not work — please try again',
  },
}
