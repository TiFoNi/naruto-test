import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { PUBLIC, ROOT, cachedJson, pruneImages, writeAtlas } from './lib.mjs'
import { dropDeleted, onlyAnswers } from './dropped.mjs'

const SEEDS = path.join(ROOT, 'seeds', 'manga')
const CACHE = path.join(ROOT, '.cache', 'manga')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(PUBLIC, 'manga')
const OUT_JSON = path.join(ROOT, 'packages', 'game', 'data', 'manga.json')
const OUT_ATLAS = path.join(ROOT, 'packages', 'game', 'data', 'manga-atlas.json')

const TITLES = [
  [1, 'one-piece', 'Ван Пис', 'One Piece', 'Эйитиро Ода', 1997, 'Сёнэн', 'Выходит'],
  [2, 'naruto', 'Наруто', 'Naruto', 'Масаси Кисимото', 1999, 'Сёнэн', 'Завершена'],
  [3, 'bleach', 'Блич', 'Bleach', 'Тайто Кубо', 2001, 'Сёнэн', 'Завершена'],
  [4, 'dragon-ball', 'Драгон Болл', 'Dragon Ball', 'Акира Торияма', 1984, 'Сёнэн', 'Завершена'],
  [5, 'death-note', 'Тетрадь смерти', 'Death Note', 'Цугуми Оба, Такэси Обата', 2003, 'Сёнэн', 'Завершена'],
  [6, 'aot', 'Атака титанов', 'Attack on Titan', 'Хадзимэ Исаяма', 2009, 'Сёнэн', 'Завершена'],
  [7, 'fma', 'Стальной алхимик', 'Fullmetal Alchemist', 'Хирому Аракава', 2001, 'Сёнэн', 'Завершена'],
  [8, 'hxh', 'Хантер × Хантер', 'Hunter × Hunter', 'Ёсихиро Тогаси', 1998, 'Сёнэн', 'Выходит'],
  [9, 'berserk', 'Берсерк', 'Berserk', 'Кэнтаро Миура', 1989, 'Сэйнэн', 'Выходит'],
  [10, 'vagabond', 'Вагабонд', 'Vagabond', 'Такэхико Иноуэ', 1998, 'Сэйнэн', 'Выходит'],
  [11, '20th-century-boys', 'Дети 20-го века', '20th Century Boys', 'Наоки Урасава', 1999, 'Сэйнэн', 'Завершена'],
  [12, 'vinland-saga', 'Сага о Винланде', 'Vinland Saga', 'Макото Юкимура', 2005, 'Сэйнэн', 'Выходит'],
  [13, 'tokyo-ghoul', 'Токийский гуль', 'Tokyo Ghoul', 'Суй Ишида', 2011, 'Сэйнэн', 'Завершена'],
  [14, 'kny', 'Клинок, рассекающий демонов', 'Demon Slayer', 'Коёхару Готогэ', 2016, 'Сёнэн', 'Завершена'],
  [15, 'jujutsu-kaisen', 'Магическая битва', 'Jujutsu Kaisen', 'Гэгэ Акутами', 2018, 'Сёнэн', 'Завершена'],
  [16, 'chainsaw-man', 'Человек-бензопила', 'Chainsaw Man', 'Тацуки Фудзимото', 2018, 'Сёнэн', 'Выходит'],
  [17, 'mha', 'Моя геройская академия', 'My Hero Academia', 'Кохэй Хорикоси', 2014, 'Сёнэн', 'Завершена'],
  [18, 'jojo', 'ДжоДжо', "JoJo's Bizarre Adventure", 'Хирохико Араки', 1987, 'Сёнэн', 'Выходит'],
  [19, 'slam-dunk', 'Слэм-данк', 'Slam Dunk', 'Такэхико Иноуэ', 1990, 'Сёнэн', 'Завершена'],
  [20, 'one-punch-man', 'Ванпанчмен', 'One Punch Man', 'ONE, Юскэ Мурата', 2012, 'Сэйнэн', 'Выходит'],
  [21, 'nana', 'Нана', 'Nana', 'Ай Ядзава', 2000, 'Сёдзё', 'Выходит'],
  [22, 'sailor-moon', 'Сейлор Мун', 'Sailor Moon', 'Наоко Такэути', 1991, 'Сёдзё', 'Завершена'],
  [23, 'punpun', 'Спокойной ночи, Пунпун', 'Oyasumi Punpun', 'Инио Асано', 2007, 'Сэйнэн', 'Завершена'],
  [24, 'blame', 'Блэйм!', 'Blame!', 'Цутому Нихэй', 1997, 'Сэйнэн', 'Завершена'],
  [25, 'gintama', 'Гинтама', 'Gintama', 'Хидэаки Сорати', 2003, 'Сёнэн', 'Завершена'],
  [26, 'akira', 'Акира', 'Akira', 'Кацухиро Отомо', 1982, 'Сэйнэн', 'Завершена'],
  [27, 'parasyte', 'Паразит', 'Parasyte', 'Хитоси Ивааки', 1988, 'Сэйнэн', 'Завершена'],
  [28, 'dorohedoro', 'Дорохедоро', 'Dorohedoro', 'Кю Хаясида', 2000, 'Сэйнэн', 'Завершена'],
  [29, 'ashita-no-joe', 'Завтрашний Джо', 'Ashita no Joe', 'Тэцуя Тиба', 1968, 'Сёнэн', 'Завершена'],
  [30, 'hellsing', 'Хеллсинг', 'Hellsing', 'Кота Хирано', 1997, 'Сэйнэн', 'Завершена'],
  [31, 'liar-game', 'Игра лжецов', 'Liar Game', 'Синобу Кайтани', 2005, 'Сэйнэн', 'Завершена'],
  [32, 'witch-hat', 'Ателье колдовских колпаков', 'Witch Hat Atelier', 'Камомэ Сирахама', 2016, 'Сэйнэн', 'Выходит'],
  [33, 'houseki', 'Страна самоцветов', 'Land of the Lustrous', 'Харуко Итикава', 2012, 'Сэйнэн', 'Завершена'],
  [34, 'evangelion', 'Евангелион', 'Neon Genesis Evangelion', 'Ёсиюки Садамото', 1994, 'Сёнэн', 'Завершена'],
  [35, 'beck', 'Бек', 'Beck', 'Харольд Сакуиси', 1999, 'Сёнэн', 'Завершена'],
  [37, 'homunculus', 'Гомункул', 'Homunculus', 'Хидэо Ямамото', 2003, 'Сэйнэн', 'Завершена'],
  [38, 'real', 'Реальность', 'Real', 'Такэхико Иноуэ', 1999, 'Сэйнэн', 'Выходит'],
  [39, 'dungeon-meshi', 'Подземелье вкусностей', 'Delicious in Dungeon', 'Рёко Куи', 2014, 'Сэйнэн', 'Завершена'],
  [40, 'yotsuba', 'Ёцуба!', 'Yotsuba&!', 'Киёхико Адзума', 2003, 'Сэйнэн', 'Выходит'],
  [43, 'black-clover', 'Чёрный клевер', 'Black Clover', 'Юки Табата', 2015, 'Сёнэн', 'Выходит'],
  [45, 'kokou-no-hito', 'Скалолаз', 'The Climber', 'Синъити Сакамото', 2007, 'Сэйнэн', 'Завершена'],
  [47, 'gantz', 'Ганц', 'Gantz', 'Хироя Оку', 2000, 'Сэйнэн', 'Завершена'],
  [48, 'fire-punch', 'Огненный удар', 'Fire Punch', 'Тацуки Фудзимото', 2016, 'Сёнэн', 'Завершена'],
  [49, 'fable', 'Басня', 'The Fable', 'Кацухиса Минами', 2014, 'Сэйнэн', 'Выходит'],
  [50, 'kingdom', 'Царство', 'Kingdom', 'Ясухиса Хара', 2006, 'Сэйнэн', 'Выходит'],
  [51, 'pluto', 'Плутон', 'Pluto', 'Наоки Урасава', 2004, 'Сэйнэн', 'Завершена'],
  [52, 'frieren', 'Фрирен, провожающая в последний путь', 'Sousou no Frieren', 'Канэхито Ямада, Цукаса Абэ', 2020, 'Сёнэн', 'Выходит'],
  [53, 'golden-kamuy', 'Золотое божество', 'Golden Kamuy', 'Сатору Нода', 2014, 'Сэйнэн', 'Завершена'],
  [55, 'lone-wolf', 'Одинокий волк и волчонок', 'Lone Wolf and Cub', 'Кадзуо Коикэ, Госэки Кодзима', 1970, 'Сэйнэн', 'Завершена'],
  [56, 'nausicaa', 'Навсикая из Долины ветров', 'Nausicaä of the Valley of the Wind', 'Хаяо Миядзаки', 1982, 'Сэйнэн', 'Завершена'],
  [63, 'noragami', 'Бездомный бог', 'Noragami', 'Адати Токa', 2010, 'Сёнэн', 'Завершена'],
  [64, 'uzumaki', 'Спираль', 'Uzumaki', 'Дзюндзи Ито', 1998, 'Сэйнэн', 'Завершена'],
  [66, 'kuroko', 'Баскетбол Куроко', 'Kuroko no Basket', 'Тадатоси Фудзимаки', 2008, 'Сёнэн', 'Завершена'],
  [67, 'kenshin', 'Бродяга Кэнсин', 'Rurouni Kenshin', 'Нобухиро Вацуки', 1994, 'Сёнэн', 'Завершена'],
  [70, 'd-gray-man', 'Ди.Грей-мен', 'D.Gray-man', 'Кацура Хосино', 2004, 'Сёнэн', 'Выходит'],
  [71, 'promised-neverland', 'Обещанный Неверленд', 'The Promised Neverland', 'Кайу Сираи, Поска Дэмидзу', 2016, 'Сёнэн', 'Завершена'],
  [72, 'dr-stone', 'Доктор Стоун', 'Dr. Stone', 'Риитиро Инагаки, Боити', 2017, 'Сёнэн', 'Завершена'],
  [75, 'hajime-no-ippo', 'Первый шаг', 'Hajime no Ippo', 'Дзёдзи Моррикава', 1989, 'Сёнэн', 'Выходит'],
  [76, 'kaiju-8', 'Кайдзю №8', 'Kaiju No. 8', 'Наоя Мацумото', 2020, 'Сёнэн', 'Завершена'],
  [77, 'dandadan', 'Дандадан', 'Dandadan', 'Юкинобу Тацу', 2021, 'Сёнэн', 'Выходит'],
  [78, 'spy-family', 'Семья шпиона', 'SPY×FAMILY', 'Тацуя Эндо', 2019, 'Сёнэн', 'Выходит'],
  [79, 'ao-no-exorcist', 'Синий экзорцист', 'Ao no Exorcist', 'Кадзуэ Като', 2009, 'Сёнэн', 'Выходит'],
  [80, 'devilman', 'Человек-дьявол', 'Devilman', 'Го Нагай', 1972, 'Сёнэн', 'Завершена'],
  [81, 'black-jack', 'Чёрный Джек', 'Black Jack', 'Осаму Тэдзука', 1973, 'Сёнэн', 'Завершена'],
  [82, 'sakamoto-days', 'Дни Сакамото', 'Sakamoto Days', 'Юто Судзуки', 2020, 'Сёнэн', 'Выходит'],
  [83, 'fairy-tail', 'Хвост феи', 'Fairy Tail', 'Хиро Масима', 2006, 'Сёнэн', 'Завершена'],
  [84, 'trigun', 'Триган', 'Trigun', 'Ясухиро Найто', 1997, 'Сёнэн', 'Завершена'],
  [85, 'blue-lock', 'Синяя тюрьма', 'Blue Lock', 'Мунэюки Канэсиро, Юсукэ Ноомура', 2018, 'Сёнэн', 'Выходит'],
  [86, 'horimiya', 'Хоримия', 'Horimiya', 'HERO, Дайсукэ Хагивара', 2011, 'Сёнэн', 'Завершена'],
  [87, 'oshi-no-ko', 'Звёздное дитя', 'Oshi no Ko', 'Ака Акасака, Мэнго Ёкояри', 2020, 'Сэйнэн', 'Завершена'],
  [88, 'made-in-abyss', 'Созданный в Бездне', 'Made in Abyss', 'Акихито Цукуси', 2012, 'Сэйнэн', 'Выходит'],
  [89, 'elfen-lied', 'Эльфийская песнь', 'Elfen Lied', 'Линн Окамото', 2002, 'Сэйнэн', 'Завершена'],
  [90, '3-gatsu', 'Мартовский лев', 'March Comes in Like a Lion', 'Тика Умино', 2007, 'Сэйнэн', 'Выходит'],
  [91, 'hokuto-no-ken', 'Кулак Северной звезды', 'Fist of the North Star', 'Буронсон, Тэцуо Хара', 1983, 'Сёнэн', 'Завершена'],
  [92, 'fruits-basket', 'Корзинка фруктов', 'Fruits Basket', 'Нацуки Такая', 1998, 'Сёдзё', 'Завершена'],
  [93, 'eyeshield-21', 'Эйршилд 21', 'Eyeshield 21', 'Риитиро Инагаки, Юсукэ Мурата', 2002, 'Сёнэн', 'Завершена'],
  [94, 'kaguya', 'Госпожа Кагуя', 'Kaguya-sama wa Kokurasetai', 'Ака Акасака', 2015, 'Сэйнэн', 'Завершена'],
  [95, 'baki', 'Боец Баки', 'Grappler Baki', 'Кэйсукэ Итагаки', 1991, 'Сёнэн', 'Завершена'],
  [96, 'initial-d', 'Инициал Ди', 'Initial D', 'Сюити Сигэно', 1995, 'Сэйнэн', 'Завершена'],
  [97, 'conan', 'Детектив Конан', 'Detective Conan', 'Госё Аояма', 1994, 'Сёнэн', 'Выходит'],
  [98, 'beastars', 'Выдающиеся звери', 'Beastars', 'Пару Итагаки', 2016, 'Сёнэн', 'Завершена'],
  [99, 'hikaru-no-go', 'Хикару и го', 'Hikaru no Go', 'Юми Хотта, Такэси Обата', 1998, 'Сёнэн', 'Завершена'],
]

const MANGADEX_IDS = {
  'dragon-ball': '40bc649f-7b49-4645-859e-6cd94136e722',
  aot: '304ceac3-8cdb-4fe7-acf7-2b6ff7a60613',
  '20th-century-boys': 'ad06790a-01e3-400c-a449-0ec152d6756a',
  'vinland-saga': '5d1fc77e-706a-4fc5-bea8-486c9be0145d',
  'tokyo-ghoul': '6a1d1cb1-ecd5-40d9-89ff-9d88e40b136b',
  kny: '789642f8-ca89-4e4e-8f7b-eee4d17ea08b',
  'jujutsu-kaisen': 'c52b2ce3-7f95-469c-96b0-479524fb7a1a',
  'chainsaw-man': 'a77742b1-befd-49a4-bff5-1ad4e6b0ef7b',
  'one-punch-man': 'd8a959f7-648e-4c8d-8f23-f1f3f8e129f3',
  nana: '7e2ddc4c-c07c-4163-bf48-2b7c45f7b7fb',
  blame: 'b905f827-8d48-4948-b58c-0d6fd330d10d',
  gintama: 'f65444dc-3694-4e31-a166-8afb2938ed55',
  akira: '175cf215-2122-4656-9fac-37ac092438af',
  kingdom: '077a3fed-1634-424f-be7a-9a96b7f07b78',
  real: '62b74aa6-24df-4b91-b76d-39e7ab3c3ca5',
  evangelion: 'dc33209f-d9d4-40df-a468-cca047b63979',
  'liar-game': 'd8779116-f000-446a-af46-cc221c0e7fc9',
  claymore: 'be8fe64b-37da-4fba-b14d-603aba19be1f',
  jigokuraku: 'cb77e4a6-3921-43b9-9d64-7d78cd3205ce',
  ajin: '331deec0-fb1a-4680-9248-8a0fc55b5b07',
  'tomodachi-game': 'b35f67b6-bfb9-4cbd-86f0-621f37e6cb41',
  'witch-hat': '67e7453b-9ee5-4ae5-9316-215b03e4a71d',
  houseki: '37bf7574-641e-4665-b992-f2ba8d4652b8',
  beck: '4cf9b503-439a-48f7-9fc5-21831087a421',
  homunculus: '231d5196-1f41-4eba-af8d-841d40bc548d',
  'dungeon-meshi': 'd90ea6cb-7bc3-4d80-8af0-28557e6c4e17',
  yotsuba: '58be6aa6-06cb-4ca5-bd20-f1392ce451fb',
  'black-clover': 'e7eabe96-aa17-476f-b431-2497d5e9d060',
  'kokou-no-hito': 'bb8310e4-6050-4a43-984e-f7bbdfce23b1',
  gantz: 'f7268daa-9d63-4e3b-9d2a-97b85b39d0cd',
  'fire-punch': '6fef1f74-a0ad-4f0d-99db-d32a7cd24098',
  fable: '5209fe10-4a14-403f-8837-2ccf8cced253',
  fma: 'dd8a907a-3850-4f95-ba03-ba201a8399e3',
  'death-note': '75ee72ab-c6bf-4b87-badd-de839156934c',
  hxh: 'db692d58-4b13-4174-ae8c-30c515c0689c',
  jojo: '5ed1f8fc-a119-4cbc-aeae-26ce2bd3f838',
  dorohedoro: '34f45c13-2b78-4900-8af2-d0bb551101f4',
  'ashita-no-joe': '4ee5e960-6329-4e1d-b038-93e8e0d53589',
  hellsing: '6fcfaa0e-6023-403e-97f9-5301dd3c258c',
  naruto: 'a787b10a-02d0-46c0-8236-0d01d69ad4a3',
  parasyte: '6ee67785-4fd5-4f84-8be9-f448314777d0',
  'sailor-moon': '00148825-e802-456c-8cfd-e10ab05d58c6',
  bleach: '239d6260-d71f-43b0-afff-074e3619e3de',
  mha: '4f3bcae4-2d96-4c9d-932c-90181d9c873e',
  berserk: '801513ba-a712-498c-8f57-cae55b38cc92',
  punpun: '4301d363-ee02-43f4-ae24-4cbf29a74830',
  'one-piece': 'a1c7c817-4e59-43b7-9365-09675a149a6f',
  vagabond: 'd1a9fdeb-f713-407f-960c-8326b586e6fd',
  'slam-dunk': '319df2e2-e6a6-4e3a-a31c-68539c140a84',
  'pluto': 'e171c073-4415-499b-85bc-ea93825127ac',
  'frieren': 'b0b721ff-c388-4486-aa0f-c2b0bb321512',
  'golden-kamuy': '8847f905-550d-4fe6-bcda-ac2b896789c7',
  'mob-psycho': '736a2bf0-f875-4b52-a7b4-e8c40505b68a',
  'lone-wolf': '526f68e3-4af1-460f-aea0-0fc29b0d6681',
  'nausicaa': '0c9e19cd-86cb-490c-93e9-955af41746ca',
  'nanatsu-no-taizai': 'e52d9403-3356-403b-b7bb-d7d6a420dd50',
  'ccs': 'e4967558-c7fa-4c48-9a4f-1e462f50fb2c',
  'ranma': 'd41bebac-1fd3-45dd-80f4-c371db540a2a',
  'fire-force': 'ec514ef4-fb77-43b9-b9b4-528229de1308',
  'tokyo-revengers': '59b36734-f2d6-46d7-97c0-06cfd2380852',
  'inuyasha': '279c2494-8f85-4e5b-8bfb-a3223441fd13',
  'noragami': 'e5ce88e2-8c46-482d-8acf-5c6d5a64a585',
  'uzumaki': 'f4cfbb1c-766e-49db-ae80-1a5db3cbcc1b',
  'haikyuu': '8f8b7cb0-7109-46e8-b12c-0448a6453dfa',
  'kuroko': 'f8e41a48-5ca9-41e3-94a7-a1379a4fda62',
  'kenshin': '754a46fa-62fa-457a-bc3b-4f31bf1373d4',
  'shokugeki': '5f20891f-0136-4fa8-afb7-d72f2af23c65',
  'bakuman': 'fa3e0b2f-4e1f-48ee-9af0-1de9dc28ca51',
  'd-gray-man': 'b6886009-e60b-44a7-abc2-a575765277ba',
  'promised-neverland': '46e9cae5-4407-4576-9b9e-4c517ae9298e',
  'dr-stone': 'cfc3d743-bd89-48e2-991f-63e680cc4edf',
  'assassination-classroom': '333f4d22-7753-4e3b-b0da-0a69b2cdce4f',
  'shaman-king': '5ce0d9df-a3cc-421e-bc33-796869b6b9f7',
  'hajime-no-ippo': 'f7888782-0727-49b0-95ec-a3530c70f83b',
  'kaiju-8': '237d527f-adb5-420e-8e6e-b7dd006fbe47',
  'dandadan': '68112dc1-2b80-4f20-beb8-2f2a8716a430',
  'spy-family': '6b958848-c885-4735-9201-12ee77abcb3c',
  'ao-no-exorcist': '3ee952f1-45c7-4c39-aea2-7df7676606d4',
  'devilman': '4393fd4e-d646-4bab-9c95-786168ccb618',
  'black-jack': 'fd86eab2-f0f3-47d3-bce5-5628e97f37dc',
  'sakamoto-days': '9d9b04ad-9a83-49f4-8ae4-a9a3780fe9c0',
  'fairy-tail': '227e3f72-863f-46f9-bafe-c43104ca29ee',
  'trigun': 'c43bff07-d61d-4fc8-81ea-967817bb3b96',
  'blue-lock': '4141c5dc-c525-4df5-afd7-cc7d192a832f',
  'horimiya': 'a25e46ec-30f7-4db6-89df-cacbc1d9a900',
  'oshi-no-ko': '296cbc31-af1a-4b5b-a34b-fee2b4cad542',
  'made-in-abyss': '80422e14-b9ad-4fda-970f-de370d5fa4e5',
  'elfen-lied': '5f7c27d0-7012-460e-83a0-020297244490',
  '3-gatsu': '0ca1627e-95dd-4118-892a-f144adf02256',
  'hokuto-no-ken': '75251a47-952c-4e38-b1c6-3572b9bfd481',
  'fruits-basket': 'e9b1d4ba-b8fb-48c3-8d52-5a4eefd05980',
  'eyeshield-21': '30460ee1-e7c1-4b1a-90a0-6861f9992c17',
  'kaguya': '37f5cce0-8070-4ada-96e5-fa24b1bd4ff9',
  'baki': 'ea3122bb-0c28-4669-8686-d6df1274512f',
  'initial-d': '21f54bc1-aefd-4be1-8284-5858b1df0e55',
  'conan': '7f30dfc3-0b80-4dcc-a3b9-0cd746fac005',
  beastars: 'f5e3baad-3cd4-427c-a2ec-ad7d776b370d',
  'hikaru-no-go': '17dcd7da-7692-420f-b813-a92159def4be',
  'blue-period': 'f8e294c0-7c11-4c66-bdd7-4e25df52bf69',
}

const UA = { 'User-Agent': 'nandaguessr-build/1.0' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getJson(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: UA }).catch(() => null)
    if (res?.ok) return res.json()
    await sleep(1500 * (attempt + 1))
  }
  return null
}

async function resolveId(slug, nameEn, year) {
  if (MANGADEX_IDS[slug]) return MANGADEX_IDS[slug]
  const search = await getJson(`https://api.mangadex.org/manga?title=${encodeURIComponent(nameEn)}&limit=5&order[relevance]=desc`)
  const list = search?.data ?? []
  const named = list.find((m) => {
    const titles = [m.attributes.title.en, ...(m.attributes.altTitles ?? []).map((t) => Object.values(t)[0])].filter(Boolean)
    return titles.some((t) => t.toLowerCase() === nameEn.toLowerCase())
  })
  return (named ?? list.find((m) => Math.abs((m.attributes.year ?? 0) - year) <= 1))?.id ?? null
}

async function coverUrl(id) {
  const list = await getJson(`https://api.mangadex.org/cover?manga[]=${id}&order[volume]=asc&limit=40`)
  const covers = list?.data ?? []
  const first =
    ['ja', 'en'].map((locale) => covers.find((c) => c.attributes.volume === '1' && c.attributes.locale === locale)).find(Boolean) ??
    covers.find((c) => c.attributes.volume === '1') ??
    covers[0]
  if (first) return `https://uploads.mangadex.org/covers/${id}/${first.attributes.fileName}`
  const manga = await getJson(`https://api.mangadex.org/manga/${id}?includes[]=cover_art`)
  const art = manga?.data?.relationships?.find((r) => r.type === 'cover_art')
  return art ? `https://uploads.mangadex.org/covers/${id}/${art.attributes.fileName}` : null
}

async function fetchCover(slug, nameEn, year) {
  const file = path.join(SEEDS, slug, 'cover.jpg')
  if (await fs.access(file).then(() => true, () => false)) return file
  const id = await resolveId(slug, nameEn, year)
  await sleep(1100)
  if (!id) return null
  const url = await coverUrl(id)
  await sleep(1100)
  if (!url) return null
  const res = await fetch(url, { headers: UA }).catch(() => null)
  if (!res?.ok) return null
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, Buffer.from(await res.arrayBuffer()))
  return file
}

const LANGS = ['en', 'ru', 'uk', 'es-la', 'pt-br']
const SPOTS = [0.15, 0.5, 0.85]
const CANDIDATES = 4
const REFRESH = process.argv.includes('--pages')
const FORCE = process.argv.includes('--force')
const DONE = path.join(CACHE, 'pages.json')

async function chapterList(id) {
  for (const lang of LANGS) {
    const all = []
    for (let offset = 0; offset < 600; offset += 100) {
      const feed = await getJson(
        `https://api.mangadex.org/manga/${id}/feed?translatedLanguage[]=${lang}&order[chapter]=asc&limit=100&offset=${offset}&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`,
      )
      const data = feed?.data ?? []
      all.push(...data.filter((one) => Number(one.attributes.pages) > 4))
      if (data.length < 100) break
      await sleep(400)
    }
    const seen = new Set()
    const unique = all.filter((one) => {
      const key = one.attributes.chapter ?? one.id
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (unique.length >= 3) return unique
    await sleep(300)
  }
  return []
}

async function detail(buffer) {
  const { data, info } = await sharp(buffer).resize(256, 256, { fit: 'inside' }).greyscale().raw().toBuffer({ resolveWithObject: true })
  let edges = 0
  let flat = 0
  for (let y = 1; y < info.height - 1; y++) {
    for (let x = 1; x < info.width - 1; x++) {
      const at = y * info.width + x
      const step = Math.abs(data[at + 1] - data[at - 1]) + Math.abs(data[at + info.width] - data[at - info.width])
      if (step > 24) edges++
      else flat++
    }
  }
  return edges / (edges + flat)
}

async function bestPage(home) {
  const files = home?.chapter?.data ?? []
  const small = home?.chapter?.dataSaver ?? []
  const inner = files.map((file, at) => at).slice(2, -2)
  if (!inner.length) return null

  const spots = Math.min(CANDIDATES, inner.length)
  const tried = []
  for (let pick = 0; pick < spots; pick++) {
    const at = inner[Math.floor(((pick + 0.5) / spots) * inner.length)]
    const name = small[at] ?? files[at]
    const folder = small[at] ? 'data-saver' : 'data'
    const res = await fetch(`${home.baseUrl}/${folder}/${home.chapter.hash}/${name}`, { headers: UA }).catch(() => null)
    if (!res?.ok) continue
    tried.push({ at, score: await detail(Buffer.from(await res.arrayBuffer())) })
    await sleep(150)
  }
  if (!tried.length) return null

  tried.sort((one, two) => two.score - one.score)
  const winner = tried[0].at
  const res = await fetch(`${home.baseUrl}/data/${home.chapter.hash}/${files[winner]}`, { headers: UA }).catch(() => null)
  return res?.ok ? Buffer.from(await res.arrayBuffer()) : null
}

async function fetchPages(slug, nameEn, year) {
  const id = await resolveId(slug, nameEn, year)
  await sleep(1100)
  if (!id) return null
  const chapters = await chapterList(id)
  if (chapters.length < 3) return null

  const dir = path.join(SEEDS, slug)
  await fs.mkdir(dir, { recursive: true })
  const picked = []
  const saved = []
  for (const [at, spot] of SPOTS.entries()) {
    const chapter = chapters[Math.min(chapters.length - 1, Math.floor(chapters.length * spot))]
    const home = await getJson(`https://api.mangadex.org/at-home/server/${chapter.id}`)
    const page = await bestPage(home)
    if (!page) continue
    saved.push(page)
    picked.push(chapter.attributes.chapter ?? '?')
    await sleep(700)
  }
  if (saved.length < 3) return null

  for (const file of await fs.readdir(dir)) {
    if (IMAGE.test(file) && !/^cover\./i.test(file)) await fs.rm(path.join(dir, file))
  }
  for (const [at, buffer] of saved.entries()) await fs.writeFile(path.join(dir, `${at + 1}.jpg`), buffer)
  return picked
}

const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i
const PAGE_WIDTH = 900
const PAGE_HEIGHT = 1300
const QUALITY = 86
const CELL = 96

async function pagesOf(slug) {
  const dir = path.join(SEEDS, slug)
  const files = (await fs.readdir(dir).catch(() => [])).filter((f) => IMAGE.test(f)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  const cover = files.find((f) => /^cover\./i.test(f))
  const pages = files.filter((f) => f !== cover)
  return { dir, cover, pages }
}

async function main() {
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'pages'), { recursive: true })
  for (const [, slug] of TITLES) await fs.mkdir(path.join(SEEDS, slug), { recursive: true })

  const done = REFRESH ? await cachedJson(CACHE, 'pages.json', async () => ({})) : {}

  const result = []
  let missing = 0
  for (const [id, slug, name, nameEn, author, year, demographic, status] of TITLES) {
    if (REFRESH && (FORCE || !done[slug])) {
      const picked = await fetchPages(slug, nameEn, year)
      console.log(`${slug}: ${picked ? `розділи ${picked.join(', ')}` : 'сторінок на MangaDex нема'}`)
      if (picked) {
        done[slug] = picked
        await fs.writeFile(DONE, JSON.stringify(done, null, 1))
      }
    }
    const { dir, cover, pages: found } = await pagesOf(slug)
    if (!found.length) missing++

    const fetched = cover ? null : await fetchCover(slug, nameEn, year)
    const fromPage = found.length > 1 && !cover && !fetched
    const pages = fromPage ? found.slice(1) : found

    const pageDir = path.join(OUT_IMG, 'pages', String(id))
    await fs.rm(pageDir, { recursive: true, force: true })
    if (pages.length) await fs.mkdir(pageDir, { recursive: true })

    for (const [i, file] of pages.entries()) {
      await sharp(path.join(dir, file))
        .resize({ width: PAGE_WIDTH, height: PAGE_HEIGHT, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(path.join(pageDir, `${i + 1}.webp`))
    }

    const coverFile = cover ? path.join(dir, cover) : (fetched ?? (fromPage ? path.join(dir, found[0]) : null))
    if (coverFile) {
      const source = await sharp(coverFile).rotate().toBuffer()
      await sharp(source)
        .resize({ width: 800, height: 900, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(path.join(OUT_IMG, 'full', `${id}.webp`))
      await sharp(source)
        .resize(CELL, CELL, { fit: 'cover', position: sharp.strategy.attention })
        .webp({ quality: QUALITY })
        .toFile(path.join(THUMBS, `${id}.webp`))
    }


    const stamp = []
    for (const file of [path.join(OUT_IMG, 'full', `${id}.webp`), ...pages.map((_, at) => path.join(pageDir, `${at + 1}.webp`))]) {
      const info = await fs.stat(file).catch(() => null)
      if (info) stamp.push(`${path.basename(file)}:${info.size}`)
    }
    const image = crypto.createHash('sha1').update(stamp.join('|')).digest('hex').slice(0, 8)

    result.push({ id, slug, name, nameEn, author, year, demographic, status, image, pages: pages.length, answer: pages.length > 0 })
  }

  dropDeleted(result, 'manga')
  onlyAnswers(result)
  const withImages = result.filter((m) => m.pages > 0)
  if (withImages.length) {
    await writeAtlas(withImages, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 8, CELL)
    for (const manga of result) manga.thumb ??= 0
  } else {
    for (const manga of result) manga.thumb = 0
    await fs.writeFile(OUT_ATLAS, JSON.stringify({ cols: 1, rows: 1, cell: CELL }))
  }
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))

  console.log(`wrote ${result.length} titles, ${withImages.length} with pages (${result.reduce((s, m) => s + m.pages, 0)} pages total)`)
  if (missing) console.log(`без картинок: ${missing} — поклади їх у seeds/manga/<slug>/ і запусти ще раз`)
}

main()
