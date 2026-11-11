const BETA_USERS = new Set(['6ab65f1c312daa6f55641731'])

export const isBeta = (id?: string | null) => !!id && BETA_USERS.has(id)
