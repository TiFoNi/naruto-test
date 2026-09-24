import type { Section } from './Legal'
import type { Lang } from './i18n/ui'

export type Doc = { title: string; updated: string; intro: string; sections: Section[] }

const UPDATED_LABEL: Record<Lang, string> = { ru: 'Обновлено', uk: 'Оновлено', en: 'Updated' }

const UPDATED: Record<Lang, string> = { ru: '24 сентября 2026', uk: '24 вересня 2026', en: '24 September 2026' }
const CONTACT = 'hello@nandaguessr.com'

const PRIVACY: Record<Lang, Omit<Doc, 'updated'>> = {
  ru: {
    title: 'Политика конфиденциальности',
    intro:
      'NandaGuessr — любительская игра, где нужно угадывать персонажей аниме и игр. Мы собираем минимум данных: только то, без чего игра не работает. Ничего не продаём и не передаём рекламным сетям.',
    sections: [
      {
        heading: 'Что мы собираем',
        paragraphs: ['Если ты играешь без аккаунта, мы не знаем о тебе ничего, кроме служебного идентификатора текущей партии.'],
        list: [
          'Адрес электронной почты — когда ты входишь через Google или по ссылке из письма.',
          'Имя и аватар из профиля Google — только если ты входишь через Google. Имя становится ником, его можно поменять.',
          'Никнейм — то, что видят другие игроки в таблице лидеров и в дуэлях.',
          'Игровая статистика — сколько персонажей угадано, серии, попытки, результаты дуэлей и челленджей.',
          'Технические записи — время партий и служебные идентификаторы, чтобы игра помнила незаконченный раунд.',
        ],
      },
      {
        heading: 'Чего мы не собираем',
        paragraphs: [
          'Мы не просим и не храним пароли: вход только через Google или по одноразовой ссылке на почту. Мы не собираем номера телефонов, адреса, платёжные данные и не используем рекламные трекеры.',
        ],
      },
      {
        heading: 'Куки',
        paragraphs: [
          'Только технические. Одна хранит сессию после входа, вторая — временный идентификатор, если ты играешь без аккаунта. Рекламных и отслеживающих куки нет.',
        ],
      },
      {
        heading: 'Кто ещё обрабатывает данные',
        paragraphs: ['Каждый сервис видит только то, что нужно ему для работы.'],
        list: [
          'Vercel — отдаёт сайт.',
          'Railway — работает серверная часть.',
          'MongoDB Atlas — хранит аккаунты и статистику.',
          'Cloudflare — домен, DNS и хранилище картинок.',
          'Resend — отправляет письма со ссылкой для входа.',
          'Google — если ты выбрал вход через Google.',
        ],
      },
      {
        heading: 'Сколько храним',
        paragraphs: [
          'Данные аккаунта и статистику — пока аккаунт существует. Партии тех, кто играет без аккаунта, удаляются автоматически через неделю.',
        ],
      },
      {
        heading: 'Как удалить свои данные',
        paragraphs: [
          `Напиши на ${CONTACT} с той почты, на которую заведён аккаунт, и мы удалим его вместе со всей статистикой. Отдельно можно сбросить только статистику — это делается в профиле.`,
        ],
      },
      { heading: 'Дети', paragraphs: ['Игра не предназначена для детей младше 13 лет, и мы сознательно не собираем их данные.'] },
      { heading: 'Изменения и связь', paragraphs: [`Если политика поменяется, мы обновим дату вверху страницы. Вопросы — на ${CONTACT}.`] },
    ],
  },
  uk: {
    title: 'Політика конфіденційності',
    intro:
      'NandaGuessr — аматорська гра, де треба вгадувати персонажів аніме та ігор. Ми збираємо мінімум даних: лише те, без чого гра не працює. Нічого не продаємо й не передаємо рекламним мережам.',
    sections: [
      {
        heading: 'Що ми збираємо',
        paragraphs: ['Якщо ти граєш без акаунта, ми не знаємо про тебе нічого, крім службового ідентифікатора поточної партії.'],
        list: [
          'Адресу електронної пошти — коли ти входиш через Google або за посиланням з листа.',
          'Ім’я та аватар із профілю Google — лише якщо ти входиш через Google. Ім’я стає ніком, його можна змінити.',
          'Нікнейм — те, що бачать інші гравці в таблиці лідерів і в дуелях.',
          'Ігрову статистику — скільки персонажів вгадано, серії, спроби, результати дуелей і челенджів.',
          'Технічні записи — час партій і службові ідентифікатори, щоб гра пам’ятала незакінчений раунд.',
        ],
      },
      {
        heading: 'Чого ми не збираємо',
        paragraphs: [
          'Ми не просимо й не зберігаємо паролі: вхід лише через Google або за одноразовим посиланням на пошту. Ми не збираємо номери телефонів, адреси, платіжні дані й не використовуємо рекламні трекери.',
        ],
      },
      {
        heading: 'Куки',
        paragraphs: [
          'Лише технічні. Одна зберігає сесію після входу, друга — тимчасовий ідентифікатор, якщо ти граєш без акаунта. Рекламних і стежних куків немає.',
        ],
      },
      {
        heading: 'Хто ще обробляє дані',
        paragraphs: ['Кожен сервіс бачить тільки те, що потрібно йому для роботи.'],
        list: [
          'Vercel — віддає сайт.',
          'Railway — працює серверна частина.',
          'MongoDB Atlas — зберігає акаунти й статистику.',
          'Cloudflare — домен, DNS і сховище картинок.',
          'Resend — надсилає листи з посиланням для входу.',
          'Google — якщо ти обрав вхід через Google.',
        ],
      },
      {
        heading: 'Скільки зберігаємо',
        paragraphs: ['Дані акаунта й статистику — поки акаунт існує. Партії тих, хто грає без акаунта, видаляються автоматично за тиждень.'],
      },
      {
        heading: 'Як видалити свої дані',
        paragraphs: [
          `Напиши на ${CONTACT} з тієї пошти, на яку заведено акаунт, і ми видалимо його разом з усією статистикою. Окремо можна скинути лише статистику — це робиться в профілі.`,
        ],
      },
      { heading: 'Діти', paragraphs: ['Гра не призначена для дітей молодших за 13 років, і ми свідомо не збираємо їхні дані.'] },
      { heading: 'Зміни та зв’язок', paragraphs: [`Якщо політика зміниться, ми оновимо дату вгорі сторінки. Питання — на ${CONTACT}.`] },
    ],
  },
  en: {
    title: 'Privacy policy',
    intro:
      'NandaGuessr is a hobby game about guessing anime and game characters. We collect the minimum: only what the game cannot work without. We sell nothing and hand nothing to ad networks.',
    sections: [
      {
        heading: 'What we collect',
        paragraphs: ['If you play without an account, we know nothing about you beyond an internal id for the current round.'],
        list: [
          'Your email address — when you sign in with Google or through a link we mail you.',
          'Your name and picture from Google — only if you sign in with Google. The name becomes your nickname and you can change it.',
          'Your nickname — what other players see on the leaderboard and in duels.',
          'Game statistics — characters guessed, streaks, attempts, duel and challenge results.',
          'Technical records — round timestamps and internal ids, so the game remembers an unfinished round.',
        ],
      },
      {
        heading: 'What we do not collect',
        paragraphs: [
          'We never ask for or store passwords: you sign in with Google or a one-time link. We collect no phone numbers, no addresses, no payment details, and we run no advertising trackers.',
        ],
      },
      {
        heading: 'Cookies',
        paragraphs: [
          'Technical only. One holds your session after signing in, the other a temporary id if you play without an account. There are no advertising or tracking cookies.',
        ],
      },
      {
        heading: 'Who else handles the data',
        paragraphs: ['Each service sees only what it needs to do its job.'],
        list: [
          'Vercel — serves the site.',
          'Railway — runs the backend.',
          'MongoDB Atlas — stores accounts and statistics.',
          'Cloudflare — domain, DNS and image storage.',
          'Resend — sends the sign-in emails.',
          'Google — if you chose to sign in with Google.',
        ],
      },
      {
        heading: 'How long we keep it',
        paragraphs: ['Account data and statistics for as long as the account exists. Rounds played without an account are deleted after a week.'],
      },
      {
        heading: 'Deleting your data',
        paragraphs: [
          `Write to ${CONTACT} from the address the account is registered to and we will delete it along with all statistics. You can also reset just the statistics from your profile.`,
        ],
      },
      { heading: 'Children', paragraphs: ['The game is not meant for children under 13, and we do not knowingly collect their data.'] },
      { heading: 'Changes and contact', paragraphs: [`If this policy changes we will update the date at the top. Questions go to ${CONTACT}.`] },
    ],
  },
}

const TERMS: Record<Lang, Omit<Doc, 'updated'>> = {
  ru: {
    title: 'Условия использования',
    intro: 'Коротко: играй в своё удовольствие, не ломай игру и не мешай другим. Ниже — то же самое подробнее.',
    sections: [
      {
        heading: 'Что это за проект',
        paragraphs: [
          'NandaGuessr — бесплатный любительский фанатский проект. Он не связан с правообладателями аниме, манги и игр, о которых идёт речь, и не выступает от их имени.',
        ],
      },
      {
        heading: 'Аккаунт',
        paragraphs: [
          'Играть можно и без аккаунта, но тогда прогресс не сохраняется. Аккаунт нужен для статистики, серий, ежедневного персонажа, дуэлей и челленджей.',
          'Отвечай за доступ к своей почте: кто получает письма, тот может войти. Никнейм не должен содержать оскорблений и выдавать тебя за другого человека.',
        ],
      },
      {
        heading: 'Честная игра',
        paragraphs: [
          'Нельзя автоматизировать подбор ответов, вытягивать ответы из запросов к серверу, создавать аккаунты пачками ради таблицы лидеров и мешать игре других. Аккаунты, замеченные в этом, мы удаляем.',
        ],
      },
      {
        heading: 'Контент и авторские права',
        paragraphs: [
          `Имена персонажей, изображения и описания принадлежат их правообладателям и используются в ознакомительных целях. Источники перечислены внизу каждой страницы. Если ты правообладатель и считаешь, что мы что-то используем неправомерно, напиши на ${CONTACT}, и мы это уберём.`,
        ],
      },
      {
        heading: 'Без гарантий',
        paragraphs: [
          'Игра предоставляется как есть. Мы стараемся, чтобы она работала, но не обещаем, что она будет доступна всегда, и не отвечаем за потерю прогресса. Мы можем менять правила, режимы и состав персонажей.',
        ],
      },
      { heading: 'Связь', paragraphs: [`По любым вопросам — ${CONTACT}.`] },
    ],
  },
  uk: {
    title: 'Умови використання',
    intro: 'Коротко: грай у своє задоволення, не ламай гру й не заважай іншим. Нижче — те саме докладніше.',
    sections: [
      {
        heading: 'Що це за проєкт',
        paragraphs: [
          'NandaGuessr — безкоштовний аматорський фанатський проєкт. Він не пов’язаний із правовласниками аніме, манґи та ігор, про які йдеться, і не виступає від їхнього імені.',
        ],
      },
      {
        heading: 'Акаунт',
        paragraphs: [
          'Грати можна й без акаунта, але тоді прогрес не зберігається. Акаунт потрібен для статистики, серій, щоденного персонажа, дуелей і челенджів.',
          'Відповідай за доступ до своєї пошти: хто отримує листи, той може увійти. Нікнейм не повинен містити образ і видавати тебе за іншу людину.',
        ],
      },
      {
        heading: 'Чесна гра',
        paragraphs: [
          'Не можна автоматизувати добір відповідей, витягати відповіді із запитів до сервера, створювати акаунти пачками заради таблиці лідерів і заважати грі інших. Акаунти, помічені в цьому, ми видаляємо.',
        ],
      },
      {
        heading: 'Контент і авторські права',
        paragraphs: [
          `Імена персонажів, зображення й описи належать їхнім правовласникам і використовуються в ознайомчих цілях. Джерела перелічені внизу кожної сторінки. Якщо ти правовласник і вважаєш, що ми щось використовуємо неправомірно, напиши на ${CONTACT}, і ми це приберемо.`,
        ],
      },
      {
        heading: 'Без гарантій',
        paragraphs: [
          'Гра надається як є. Ми намагаємось, щоб вона працювала, але не обіцяємо, що вона буде доступна завжди, і не відповідаємо за втрату прогресу. Ми можемо змінювати правила, режими й склад персонажів.',
        ],
      },
      { heading: 'Зв’язок', paragraphs: [`З будь-яких питань — ${CONTACT}.`] },
    ],
  },
  en: {
    title: 'Terms of use',
    intro: 'Short version: play and enjoy it, do not break the game, do not spoil it for others. The longer version follows.',
    sections: [
      {
        heading: 'What this is',
        paragraphs: [
          'NandaGuessr is a free fan project. It is not affiliated with, and does not speak for, the rights holders of the anime, manga and games it covers.',
        ],
      },
      {
        heading: 'Your account',
        paragraphs: [
          'You can play without an account, but nothing is saved. An account is what gives you statistics, streaks, the daily character, duels and challenges.',
          'Look after access to your mailbox: whoever receives the mail can sign in. Nicknames must not be abusive or impersonate someone else.',
        ],
      },
      {
        heading: 'Fair play',
        paragraphs: [
          'No automating guesses, no digging answers out of the server responses, no creating accounts in bulk to game the leaderboard, no interfering with other people. Accounts caught doing this get deleted.',
        ],
      },
      {
        heading: 'Content and copyright',
        paragraphs: [
          `Character names, images and descriptions belong to their rights holders and are used for reference. The sources are listed at the bottom of every page. If you hold the rights and believe something is used improperly, write to ${CONTACT} and we will take it down.`,
        ],
      },
      {
        heading: 'No warranty',
        paragraphs: [
          'The game is provided as is. We try to keep it running, but we do not promise it will always be available and we are not liable for lost progress. Rules, modes and the roster may change.',
        ],
      },
      { heading: 'Contact', paragraphs: [`Anything at all — ${CONTACT}.`] },
    ],
  },
}

const stamp = (lang: Lang) => `${UPDATED_LABEL[lang]} ${UPDATED[lang]}`

export const privacy = (lang: Lang): Doc => ({ ...PRIVACY[lang], updated: stamp(lang) })
export const terms = (lang: Lang): Doc => ({ ...TERMS[lang], updated: stamp(lang) })
