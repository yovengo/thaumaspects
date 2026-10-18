import { currentUser, failure, json } from '@/server/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    return json({ user: await currentUser() })
  } catch (error) {
    return failure(error)
  }
}
