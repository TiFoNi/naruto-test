import type { MetadataRoute } from 'next'
import { SITE } from '@/src/brand'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/*/c/', '/*/duel/', '/*/duels', '/*/daily'] },
    sitemap: `${SITE}/sitemap.xml`,
  }
}
