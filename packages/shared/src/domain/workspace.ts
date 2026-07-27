import type { Id } from '../ids.ts'
import type { User } from './user.ts'

// Two roles, not three. An `owner` tier would add rules about who may delete the
// workspace, who may invite an owner, and who may not be removed — protecting
// distinctions (billing, legal ownership) that do not exist yet.
export type Role = 'admin' | 'member'

export type Workspace = {
  readonly id: Id
  readonly name: string
  readonly createdAt: string
}

// A workspace as seen by one user: the workspace plus that user's role in it.
export type WorkspaceMembership = Workspace & {
  readonly role: Role
}

// A member of a workspace, as shown to other members. Built on `User`, so it
// structurally cannot carry a phone number.
export type WorkspaceMember = User & {
  readonly role: Role
  readonly joinedAt: string
}

export const isAdmin = (role: Role): boolean => role === 'admin'
