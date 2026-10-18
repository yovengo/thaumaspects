export const sessionKey = ['auth', 'session'] as const
export const codeKey = (userId: string) => ['auth', 'code', userId] as const
export const favoritesKey = (userId: string) => ['favorites', userId] as const
