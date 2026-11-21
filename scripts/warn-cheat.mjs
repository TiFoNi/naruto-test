import { randomUUID } from 'node:crypto'
import { MongoClient } from 'mongodb'
import { Resend } from 'resend'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')
const at = process.argv.indexOf('--nick')
const nicks = at > 0 ? (process.argv[at + 1] ?? '').split(',').map((one) => one.trim()).filter(Boolean) : []
if (!nicks.length) throw new Error('потрібно --nick нік1,нік2')
const write = process.argv.includes('--write')
const mailOnly = process.argv.includes('--mail-only')
const bellOnly = process.argv.includes('--bell-only')

const FROM = process.env.MAIL_FROM ?? 'NandaGuessr <noreply@nandaguessr.com>'
const REPLY = 'hello@nandaguessr.com'
const TERMS = 'https://nandaguessr.com/ru/terms#fair-play'
const SUBJECT = 'Предупреждение: нарушение правил честной игры'
const TITLE = 'Предупреждение о нечестной игре'
const NOTE =
  'В твоём аккаунте замечены признаки игры с помощью сторонней программы-подсказчика. Это нарушает правила честной игры. Пока это предупреждение: если нарушения продолжатся, сезонный опыт будет обнулён, а аккаунт убран из таблицы лидеров.'

const mask = (mail) => mail.replace(/^(.).*(@.*)$/, '$1***$2')

const letter = (nick) => {
  const text = `Привет, ${nick}!

Мы заметили в твоём аккаунте признаки нечестной игры: цепочки отгадок, характерные для сторонних программ-подсказчиков.

Это нарушает правила честной игры (раздел «Честная игра» в Условиях: ${TERMS}).

Пока это предупреждение. Если нарушения продолжатся, сезонный опыт будет обнулён, а аккаунт убран из таблицы лидеров.

Если считаешь, что это ошибка, напиши нам на ${REPLY}.

Команда NandaGuessr`
  const html = `<!doctype html>
<html lang="ru"><body style="margin:0;padding:32px 16px;background:#0d0f12;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
  <table role="presentation" style="max-width:520px;margin:0 auto;background:#161a1f;border-radius:16px;padding:32px">
    <tr><td>
      <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#eef0f3">Nanda<span style="color:#ff8a1f">Guessr</span></p>
      <p style="margin:0 0 20px;font-size:17px;font-weight:700;color:#ff6b6b">Предупреждение о нечестной игре</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#eef0f3">Привет, ${nick}!</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#a7afbb">Мы заметили в твоём аккаунте признаки нечестной игры: цепочки отгадок, характерные для сторонних программ-подсказчиков.</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#a7afbb">Это нарушает <a href="${TERMS}" style="color:#ff8a1f">правила честной игры</a>.</p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#eef0f3">Пока это предупреждение. Если нарушения продолжатся, сезонный опыт будет обнулён, а аккаунт убран из таблицы лидеров.</p>
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#6e7684">Если считаешь, что это ошибка, напиши нам на <a href="mailto:${REPLY}" style="color:#ff8a1f">${REPLY}</a>.</p>
      <p style="margin:20px 0 0;font-size:13px;color:#6e7684">Команда NandaGuessr</p>
    </td></tr>
  </table>
</body></html>`
  return { text, html }
}

const key = process.env.RESEND_API_KEY
if (write && !bellOnly && !key) throw new Error('RESEND_API_KEY не задано')
const resend = key ? new Resend(key) : null

const client = new MongoClient(uri)
await client.connect()
const users = client.db(process.env.MONGODB_DB || 'nandaguessr').collection('users')

for (const nick of nicks) {
  const found = await users.find({ nicknameLower: nick.toLowerCase() }, { projection: { nickname: 1, username: 1 } }).toArray()
  if (found.length !== 1) {
    console.log(`${nick}: ${found.length ? 'кілька акаунтів з таким ніком' : 'не знайдено'}, пропускаю`)
    continue
  }
  const [user] = found
  const mail = typeof user.username === 'string' && user.username.includes('@') ? user.username : null
  console.log(bellOnly ? `${user.nickname}: тільки дзвіночок` : `${user.nickname}: лист → ${mail ? mask(mail) : 'пошти немає, тільки дзвіночок'}`)
  if (!write) continue
  if (mail && !bellOnly) {
    const { text, html } = letter(user.nickname)
    const { error } = await resend.emails.send({ from: FROM, to: mail, replyTo: REPLY, subject: SUBJECT, html, text })
    console.log(error ? `  лист не пішов: ${error.message}` : '  лист надіслано')
  }
  if (mailOnly) continue
  await users.updateOne({ _id: user._id }, { $push: { systemNews: { $each: [{ id: randomUUID(), title: TITLE, text: NOTE, at: new Date() }], $slice: -10 } } })
  console.log('  у дзвіночок додано')
}

if (!write) console.log(`\nтема: ${SUBJECT}\n\n${letter('<нік>').text}\n\nу дзвіночку: ${TITLE}\n${NOTE}\n\nце перевірка, нічого не надіслано; для відправки додай --write`)
await client.close()
