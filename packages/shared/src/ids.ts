// Every persisted entity is keyed by a database-generated autoincrement int.
// Aliased so call sites read as intent (`Id`) rather than as storage detail,
// and so a future switch to string ids is a one-line change here.
export type Id = number
