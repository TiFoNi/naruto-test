'use client'

import Link from 'next/link'
import { BRAND } from './brand'
import { CONTACT, SOCIALS } from './contacts'
import { useI18n } from './i18n'
import { useHref } from './router'
import SocialGlyph from './SocialGlyph'

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

          <Link className="footer-support" href={href.support}>
            <i aria-hidden>
              <SocialGlyph id="support" />
            </i>
            <span>
              <b>{t('social.support')}</b>
              <small>{t('social.support.hint')}</small>
            </span>
          </Link>
        </div>

        <nav className="footer-col" aria-label={t('footer.nav')}>
          <h2>{t('footer.nav')}</h2>
          <Link href={href.home}>{t('footer.home')}</Link>
          <Link href={href.worlds}>{t('worlds.title')}</Link>
          <Link href={href.board}>{t('nav.leaderboard')}</Link>
          <Link href={href.duels}>{t('nav.duels')}</Link>
          <Link href={href.achievements}>{t('ach.title')}</Link>
          <Link href={href.shop}>{t('nav.shop')}</Link>
        </nav>

        <nav className="footer-col footer-help" aria-label={t('footer.contact')}>
          <h2>{t('footer.contact')}</h2>
          {CONTACT.email && (
            <a className="footer-note is-mail" href={`mailto:${CONTACT.email}`} style={{ '--social': '#f0862a' } as React.CSSProperties}>
              <i aria-hidden>
                <SocialGlyph id="mail" />
              </i>
              <span>
                <small>{t('footer.mailHint')}</small>
                <b>{CONTACT.email}</b>
              </span>
            </a>
          )}
          {SOCIALS.map((social) => (
            <a
              key={social.id}
              className={`footer-note is-${social.id}`}
              href={social.href}
              target="_blank"
              rel="noreferrer noopener"
              style={{ '--social': social.accent } as React.CSSProperties}
            >
              <i aria-hidden>
                <SocialGlyph id={social.id} />
              </i>
              <span>
                <small>{social.label}</small>
                <b>{social.handle}</b>
              </span>
            </a>
          ))}
        </nav>
      </div>

      <div className="footer-fine">
        <p className="footer-copy">
          © {new Date().getFullYear()} {BRAND.name}. {t('footer.rights')}
        </p>
        <nav className="footer-legal" aria-label={t('footer.legal')}>
          <Link href={href.privacy}>{t('footer.privacy')}</Link>
          <Link href={href.terms}>{t('footer.terms')}</Link>
          <Link href={href.refunds}>{t('footer.refunds')}</Link>
          <Link href={href.sources}>{t('footer.sourcesLink')}</Link>
        </nav>
      </div>

      <p className="footer-disclaimer">{t('footer.disclaimer')}</p>
    </footer>
  )
}
