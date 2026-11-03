const build = async () => {
  const [{ createAuthClient }, { magicLinkClient }, { passkeyClient }] = await Promise.all([
    import('better-auth/react'),
    import('better-auth/client/plugins'),
    import('@better-auth/passkey/client'),
  ])
  return createAuthClient({
    basePath: '/api/auth',
    plugins: [magicLinkClient(), passkeyClient()],
  })
}

let pending: ReturnType<typeof build> | null = null

export const authClient = () => (pending ??= build())
