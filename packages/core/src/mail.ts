import { Resend } from 'resend'

const FROM = process.env.MAIL_FROM ?? 'NandaGuessr <noreply@nandaguessr.com>'

let client: Resend | null = null

const resend = () => {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  client ??= new Resend(key)
  return client
}

export async function sendMail(to: string, subject: string, html: string, text: string) {
  const api = resend()
  if (!api) {
    console.log(`[mail] RESEND_API_KEY не задано, лист для ${to} не відправлено:\n${text}`)
    return
  }
  const { error } = await api.emails.send({ from: FROM, to, subject, html, text })
  if (error) throw new Error(`не вдалося відправити лист: ${error.message}`)
}

export function magicLinkMail(url: string) {
  const subject = 'Вход в NandaGuessr'
  const text = `Ссылка для входа в NandaGuessr:\n\n${url}\n\nОна работает 15 минут и только один раз. Если ты этого не запрашивал — просто удали письмо.`
  const html = `<!doctype html>
<html lang="ru"><body style="margin:0;padding:32px 16px;background:#0d0f12;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
  <table role="presentation" style="max-width:480px;margin:0 auto;background:#161a1f;border-radius:16px;padding:32px">
    <tr><td>
      <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#eef0f3">Nanda<span style="color:#ff8a1f">Guessr</span></p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#a7afbb">Нажми кнопку, чтобы войти. Ссылка работает 15 минут и только один раз.</p>
      <a href="${url}" style="display:inline-block;padding:12px 28px;border-radius:999px;background:#ff8a1f;color:#0d0f12;font-weight:700;font-size:15px;text-decoration:none">Войти</a>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6e7684">Если кнопка не работает, скопируй адрес:<br><span style="color:#a7afbb;word-break:break-all">${url}</span></p>
      <p style="margin:20px 0 0;font-size:13px;color:#6e7684">Если ты этого не запрашивал — просто удали письмо.</p>
    </td></tr>
  </table>
</body></html>`
  return { subject, html, text }
}
