'use client'

import Link from 'next/link'
import { BRAND } from './brand'
import { CONTACT, SOCIALS, SOURCES } from './contacts'
import { useI18n } from './i18n'
import { MailIcon } from './icons'
import { useHref } from './router'

export default function Footer() {
  const { t } = useI18n()
  const href = useHref()

  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <span className="footer-logo">
            <span className="brand-mark" aria-hidden>
              {BRAND.mark}
            </span>
            <span className="brand-name">
              {BRAND.parts[0]}
              <em>{BRAND.parts[1]}</em>
            </span>
          </span>
          <p>{t('footer.tagline')}</p>
        </div>

        <nav className="footer-col" aria-label={t('footer.legal')}>
          <h2>{t('footer.legal')}</h2>
          <Link href={href.privacy}>{t('footer.privacy')}</Link>
          <Link href={href.terms}>{t('footer.terms')}</Link>
        </nav>

        {(CONTACT.email || CONTACT.support || SOCIALS.length > 0) && (
          <nav className="footer-col" aria-label={t('footer.contact')}>
            <h2>{t('footer.contact')}</h2>
            {CONTACT.email && (
              <a href={`mailto:${CONTACT.email}`}>
                <MailIcon /> {CONTACT.email}
              </a>
            )}
            {CONTACT.support && <a href={CONTACT.support}>{t('footer.support')}</a>}
            {SOCIALS.length > 0 && (
              <span className="footer-socials">
                {SOCIALS.map((social) => (
                  <a key={social.id} href={social.href} target="_blank" rel="noreferrer noopener" aria-label={social.label}>
                    {social.label}
                  </a>
                ))}
              </span>
            )}
          </nav>
        )}
      </div>

      <div className="footer-fine">
        <p>{t('footer.disclaimer')}</p>
        <p className="footer-sources">
          {t('footer.data')}: {SOURCES.join(', ')}.
        </p>
        <p className="footer-copy">
          © {new Date().getFullYear()} {BRAND.name}
        </p>
      </div>
    </footer>
  )
}
