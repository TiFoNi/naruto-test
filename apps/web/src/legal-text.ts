import type { Section } from './Legal'
import type { Lang } from './i18n/ui'

export type Doc = { title: string; updated: string; intro: string; sections: Section[] }

const UPDATED_LABEL: Record<Lang, string> = { ru: 'Обновлено', uk: 'Оновлено', en: 'Updated' }

const UPDATED: Record<Lang, string> = { ru: '15 октября 2026', uk: '15 жовтня 2026', en: '15 October 2026' }
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
          'Платёжный сервис приёма криптовалюты — проводит оплату монет и хранит данные платежа.',
        ],
      },
      {
        heading: 'Покупки',
        paragraphs: [
          'Когда ты покупаешь монеты, у нас остаётся только номер заказа, название пакета, сумма, валюта и дата — этого хватает, чтобы начислить монеты и разобраться в спорной ситуации. Номер карты к нам не попадает: его видит только платёжный партнёр.',
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
          'Платіжний сервіс приймання криптовалюти — проводить оплату монет і зберігає дані платежу.',
        ],
      },
      {
        heading: 'Покупки',
        paragraphs: [
          'Коли ти купуєш монети, у нас лишається тільки номер замовлення, назва пакета, сума, валюта й дата — цього досить, щоб нарахувати монети та розібратися в спірній ситуації. Номер картки до нас не потрапляє: його бачить лише платіжний партнер.',
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
          'Our crypto payment processor — handles coin payments and stores the payment details.',
        ],
      },
      {
        heading: 'Purchases',
        paragraphs: [
          'When you buy coins we keep only the order id, the pack name, the amount, the currency and the date — enough to credit the coins and to sort out a dispute. Your card number never reaches us: only the payment partner sees it.',
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
        heading: 'Монеты и оплата',
        paragraphs: [
          'Монеты — внутриигровая валюта NandaGuessr. Их можно заработать в игре или купить пакетом. Тратятся монеты только внутри игры: на рамки профиля, аватарки и другие украшения и игровые мелочи.',
          'Монеты — не деньги и не платёжное средство. Их нельзя обменять обратно на деньги, вывести, передать другому аккаунту или продать. Реальной стоимости у них нет.',
          'Цены указаны в долларах США, оплата — криптовалютой через наш платёжный сервис. Он показывает курс и адрес кошелька, принимает перевод и сообщает нам о подтверждении. Кошелёк и сумму перевода видит он, мы храним только номер заказа и сумму в долларах.',
          'Монеты зачисляются сразу после того, как сеть подтвердит перевод: обычно это минуты, но у разных монет по-разному. Если через час монет нет, напиши на hello@nandaguessr.com и приложи номер заказа и хеш транзакции.',
          'Покупка привязана к тому аккаунту, с которого сделана. Если аккаунт удалён или заблокирован за нарушение правил, оставшиеся монеты сгорают, а деньги не возвращаются.',
          'Мы можем менять цены, состав пакетов и то, на что тратятся монеты. Уже купленные монеты при этом никуда не денутся. Когда и как возвращаются деньги — написано на странице «Возврат средств».',
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
        heading: 'Монети та оплата',
        paragraphs: [
          'Монети — внутрішньоігрова валюта NandaGuessr. Їх можна заробити в грі або купити пакетом. Витрачаються монети лише всередині гри: на рамки профілю, аватарки та інші прикраси й ігрові дрібниці.',
          'Монети — не гроші й не платіжний засіб. Їх не можна обміняти назад на гроші, вивести, передати іншому акаунту чи продати. Реальної вартості вони не мають.',
          'Ціни вказані в доларах США, оплата — криптовалютою через наш платіжний сервіс. Він показує курс і адресу гаманця, приймає переказ і повідомляє нам про підтвердження. Гаманець і суму переказу бачить він, ми зберігаємо лише номер замовлення та суму в доларах.',
          'Монети зараховуються одразу після того, як мережа підтвердить переказ: зазвичай це хвилини, але в різних монет по-різному. Якщо за годину монет немає, напиши на hello@nandaguessr.com і додай номер замовлення та хеш транзакції.',
          'Покупка прив’язана до того акаунта, з якого зроблена. Якщо акаунт видалено або заблоковано за порушення правил, решта монет згорає, а гроші не повертаються.',
          'Ми можемо змінювати ціни, склад пакетів і те, на що витрачаються монети. Уже куплені монети при цьому нікуди не зникнуть. Коли і як повертаються гроші — написано на сторінці «Повернення коштів».',
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
        heading: 'Coins and payment',
        paragraphs: [
          'Coins are the in-game currency of NandaGuessr. You can earn them by playing or buy them in a pack. They are spent inside the game only: on profile frames, avatars and other cosmetics and small in-game extras.',
          'Coins are not money and not a means of payment. They cannot be exchanged back into money, cashed out, transferred to another account or sold. They have no real-world value.',
          'Prices are in US dollars and paid in crypto through our payment processor. It shows the rate and the wallet address, takes the transfer and tells us once it is confirmed. The wallet and the transferred amount stay with them; we keep only the order id and the dollar amount.',
          'Coins are credited as soon as the network confirms the transfer — usually minutes, though it varies by coin. If they are still missing after an hour, write to hello@nandaguessr.com with the order id and the transaction hash.',
          'A purchase belongs to the account it was made from. If that account is deleted or banned for breaking the rules, the remaining coins are lost and the money is not refunded.',
          'We may change prices, the contents of the packs and what coins can be spent on. Coins you already bought stay yours. When and how money is refunded is described on the Refund policy page.',
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

const REFUNDS: Record<Lang, Omit<Doc, 'updated'>> = {
  ru: {
    title: 'Возврат средств',
    intro:
      'Здесь написано, что именно ты покупаешь, когда мы возвращаем деньги за монеты, когда не возвращаем и как попросить возврат. Если коротко: напиши нам, и мы разберёмся по-человечески.',
    sections: [
      {
        heading: 'Что ты покупаешь',
        paragraphs: [
          'Монеты — цифровой товар. Они зачисляются на аккаунт сразу после подтверждения оплаты и тратятся только внутри NandaGuessr. Обменять их обратно на деньги нельзя.',
          'Оплата идёт криптовалютой через наш платёжный сервис. Перевод в блокчейне отменить нельзя — возврат мы делаем вручную, отдельным переводом на тот же кошелёк.',
        ],
      },
      {
        heading: 'Право на отказ',
        paragraphs: [
          'Если ты покупаешь из ЕС, ЕЭЗ или Великобритании, у тебя есть 14 дней на отказ от покупки цифрового товара. Нажимая кнопку оплаты, ты просишь поставить монеты немедленно и соглашаешься, что после их зачисления право на отказ пропадает — так закон устроен для цифровых товаров.',
          'Если по закону твоей страны срок или условия выгоднее, действуют они, а не эта страница.',
        ],
      },
      {
        heading: 'Когда мы вернём деньги',
        paragraphs: ['Это те случаи, где возврат — по умолчанию.'],
        list: [
          'Монеты не зачислились, и мы не смогли это починить.',
          'За один заказ списали дважды.',
          'С твоей карты заплатили без твоего ведома — напиши нам, мы разберёмся.',
          'Пакет оказался не таким, как описан на странице покупки.',
        ],
      },
      {
        heading: 'Когда не вернём',
        paragraphs: ['Тут возврата не будет, и это честно сказать сразу.'],
        list: [
          'Монеты уже потрачены — полностью или частично.',
          'Ты просто передумал после того, как монеты зачислены.',
          'Аккаунт заблокирован за нарушение правил.',
          'С момента покупки прошло больше 14 дней, и закон твоей страны не даёт большего срока.',
        ],
      },
      {
        heading: 'Как попросить возврат',
        paragraphs: [
          `Напиши на ${CONTACT} с почты, на которую заведён аккаунт. Укажи номер заказа (он виден на странице оплаты), хеш транзакции и что случилось.`,
          'Мы отвечаем в течение 3 рабочих дней. Если возврат одобрен, мы отправляем перевод той же монетой на кошелёк, с которого пришла оплата, обычно в течение 5 рабочих дней. Комиссию сети за обратный перевод удерживаем, курс берём на момент возврата. Монеты из возвращённого заказа списываются с аккаунта; если их уже потратили, возврат может быть частичным.',
        ],
      },
      {
        heading: 'Спорные списания',
        paragraphs: [
          'Крипто-перевод нельзя отменить через банк, поэтому единственный путь — написать нам. Если перевод ушёл не туда, завис или сумма не та, пиши с номером заказа и хешем транзакции, и мы разберёмся вручную.',
        ],
      },
      { heading: 'Связь', paragraphs: [`Любые вопросы по оплате — ${CONTACT}.`] },
    ],
  },
  uk: {
    title: 'Повернення коштів',
    intro:
      'Тут написано, що саме ти купуєш, коли ми повертаємо гроші за монети, коли не повертаємо і як попросити повернення. Якщо коротко: напиши нам, і ми розберемося по-людськи.',
    sections: [
      {
        heading: 'Що ти купуєш',
        paragraphs: [
          'Монети — цифровий товар. Вони зараховуються на акаунт одразу після підтвердження оплати і витрачаються лише всередині NandaGuessr. Обміняти їх назад на гроші не можна.',
          'Оплата йде криптовалютою через наш платіжний сервіс. Переказ у блокчейні скасувати не можна — повернення ми робимо вручну, окремим переказом на той самий гаманець.',
        ],
      },
      {
        heading: 'Право на відмову',
        paragraphs: [
          'Якщо ти купуєш із ЄС, ЄЕЗ або Великої Британії, у тебе є 14 днів на відмову від покупки цифрового товару. Натискаючи кнопку оплати, ти просиш поставити монети негайно і погоджуєшся, що після їх зарахування право на відмову зникає — так закон влаштований для цифрових товарів.',
          'Якщо за законом твоєї країни строк або умови вигідніші, діють вони, а не ця сторінка.',
        ],
      },
      {
        heading: 'Коли ми повернемо гроші',
        paragraphs: ['Це випадки, де повернення — за замовчуванням.'],
        list: [
          'Монети не зарахувалися, і ми не змогли це полагодити.',
          'За одне замовлення списали двічі.',
          'З твоєї картки заплатили без твого відома — напиши нам, ми розберемося.',
          'Пакет виявився не таким, як описано на сторінці покупки.',
        ],
      },
      {
        heading: 'Коли не повернемо',
        paragraphs: ['Тут повернення не буде, і чесніше сказати це одразу.'],
        list: [
          'Монети вже витрачені — повністю або частково.',
          'Ти просто передумав після того, як монети зараховано.',
          'Акаунт заблоковано за порушення правил.',
          'Від покупки минуло більше ніж 14 днів, і закон твоєї країни не дає довшого строку.',
        ],
      },
      {
        heading: 'Як попросити повернення',
        paragraphs: [
          `Напиши на ${CONTACT} з пошти, на яку заведено акаунт. Вкажи номер замовлення (він видно на сторінці оплати), хеш транзакції і що сталося.`,
          'Ми відповідаємо протягом 3 робочих днів. Якщо повернення схвалено, ми надсилаємо переказ тією самою монетою на гаманець, з якого прийшла оплата, зазвичай протягом 5 робочих днів. Комісію мережі за зворотний переказ утримуємо, курс беремо на момент повернення. Монети з поверненого замовлення списуються з акаунта; якщо їх уже витрачено, повернення може бути частковим.',
        ],
      },
      {
        heading: 'Спірні списання',
        paragraphs: [
          'Крипто-переказ не можна скасувати через банк, тож єдиний шлях — написати нам. Якщо переказ пішов не туди, завис або сума не та, пиши з номером замовлення та хешем транзакції, і ми розберемося вручну.',
        ],
      },
      { heading: 'Зв’язок', paragraphs: [`Будь-які питання щодо оплати — ${CONTACT}.`] },
    ],
  },
  en: {
    title: 'Refund policy',
    intro:
      'This page says what you are buying, when we refund coin purchases, when we do not, and how to ask for a refund. Short version: write to us and we will sort it out like humans.',
    sections: [
      {
        heading: 'What you are buying',
        paragraphs: [
          'Coins are a digital product. They are credited to your account as soon as the payment is confirmed and can only be spent inside NandaGuessr. They cannot be exchanged back into money.',
          'Payments go through our crypto payment processor. A blockchain transfer cannot be cancelled, so refunds are made by hand, as a separate transfer back to the same wallet.',
        ],
      },
      {
        heading: 'Right of withdrawal',
        paragraphs: [
          'If you buy from the EU, the EEA or the UK, you have 14 days to withdraw from a digital purchase. By pressing the payment button you ask for the coins to be delivered immediately and agree that the right of withdrawal ends once they are credited — that is how the law works for digital goods.',
          'If the law where you live gives you a longer period or better terms, that law applies, not this page.',
        ],
      },
      {
        heading: 'When we refund',
        paragraphs: ['These cases are refunded by default.'],
        list: [
          'The coins never arrived and we could not fix it.',
          'You were charged twice for one order.',
          'Someone paid with your card without your knowledge — write to us and we will look into it.',
          'The pack was not what the purchase page described.',
        ],
      },
      {
        heading: 'When we do not',
        paragraphs: ['No refund here, and it is fairer to say so up front.'],
        list: [
          'The coins have already been spent, fully or in part.',
          'You simply changed your mind after the coins were credited.',
          'The account was banned for breaking the rules.',
          'More than 14 days have passed and your local law does not give you longer.',
        ],
      },
      {
        heading: 'How to ask for a refund',
        paragraphs: [
          `Write to ${CONTACT} from the email your account uses. Include the order id (it is shown on the payment page), the transaction hash and what went wrong.`,
          'We answer within 3 business days. If the refund is approved, we send the same coin back to the wallet the payment came from, usually within 5 business days. The network fee for that transfer is deducted and the rate is taken at the time of the refund. The coins from that order are removed from the account; if they were already spent, the refund may be partial.',
        ],
      },
      {
        heading: 'Disputed charges',
        paragraphs: [
          'A crypto transfer cannot be reversed by a bank, so the only way is to write to us. If a transfer went to the wrong place, got stuck or the amount is off, send the order id and the transaction hash and we will sort it out by hand.',
        ],
      },
      { heading: 'Contact', paragraphs: [`Anything about payments — ${CONTACT}.`] },
    ],
  },
}

const stamp = (lang: Lang) => `${UPDATED_LABEL[lang]} ${UPDATED[lang]}`

export const privacy = (lang: Lang): Doc => ({ ...PRIVACY[lang], updated: stamp(lang) })
export const terms = (lang: Lang): Doc => ({ ...TERMS[lang], updated: stamp(lang) })
export const refunds = (lang: Lang): Doc => ({ ...REFUNDS[lang], updated: stamp(lang) })
