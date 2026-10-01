const build = async () => {
  const [{ createAuthClient }, { magicLinkClient }, { passkeyClient }] = await Promise.all([
    import('better-auth/react'),
    import('better-auth/client/plugins'),
    import('@better-auth/passkey/client'),
  ])
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '')

  return createAuthClient({
    ...(base ? { baseURL: base } : {}),
    basePath: '/api/auth',
    plugins: [magicLinkClient(), passkeyClient()],
  })
}

let pending: ReturnType<typeof build> | null = null

export const authClient = () => (pending ??= build())
