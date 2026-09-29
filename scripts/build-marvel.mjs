import fs from 'node:fs/promises'
import path from 'node:path'
import { PUBLIC, ROOT, cachedDownload, cachedJson, pool, pruneImages, wikiImageUrls, wikiPages, wikiQuery, writeAtlas, writeFullAndThumb } from './lib.mjs'
import { dropDeleted, onlyAnswers } from './dropped.mjs'

const API = 'https://marvel.fandom.com/api.php'
const CACHE = path.join(ROOT, '.cache', 'marvel')
const THUMBS = path.join(CACHE, 'thumb')
const OUT_IMG = path.join(PUBLIC, 'marvel')
const OUT_JSON = path.join(ROOT, 'packages', 'game', 'data', 'marvel.json')
const OUT_ATLAS = path.join(ROOT, 'packages', 'game', 'data', 'marvel-atlas.json')

const PICK = {
  'Green Goblin': 'Norman Osborn (Earth-616) from Bring on the Bad Guys Green Goblin Vol 1 1 001.jpg',
  Lizard: 'Curtis Connors (Earth-616) from Amazing Spider-Man Vol 1 44 0002.jpg',
  'Doctor Strange': 'Stephen Strange (Earth-616) from Doctor Strange Vol 5 5 001.png',
  'Doctor Doom': 'Victor von Doom (Earth-616) from Books of Doom Vol 1 5 0002.jpg',
  'Professor X': 'Charles Xavier (Earth-616) from Astonishing X-Men Vol 3 10 001.jpg',
  'Winter Soldier': 'James Buchanan Barnes (Earth-616) from Official Handbook of the Marvel Universe Vol 2 16 0001.jpg',
  Mantis: 'Mantis (Brandt) (Earth-616) from Silver Surfer Vol 3 3 0001.jpg',
  Sentry: 'Robert Reynolds (Earth-616) from New Avengers Vol 1 10 001.jpg',
  Polaris: 'Lorna Dane (Earth-616) from X-Men Legends Vol 1 5 001.jpg',
}

const M = 'Мужской'
const F = 'Женский'
const HERO = 'Герой'
const VILLAIN = 'Злодей'
const ANTI = 'Антигерой'

// [сторінка вікі, en, ru, uk, стать, сторона, команди, сили, вид, рік дебюту]
const ROSTER = [
  ['Anthony Stark (Earth-616)', 'Iron Man', 'Железный человек', 'Залізна людина', M, HERO, ['Мстители'], ['Технологии', 'Полёт'], 'Человек', 1963],
  ['Steven Rogers (Earth-616)', 'Captain America', 'Капитан Америка', 'Капітан Америка', M, HERO, ['Мстители'], ['Сила', 'Боевые навыки'], 'Человек', 1941],
  ['Thor Odinson (Earth-616)', 'Thor', 'Тор', 'Тор', M, HERO, ['Мстители'], ['Сила', 'Полёт', 'Магия'], 'Асгардиец', 1962],
  ['Bruce Banner (Earth-616)', 'Hulk', 'Халк', 'Халк', M, HERO, ['Мстители'], ['Сила', 'Регенерация'], 'Мутант', 1962],
  ['Natasha Romanoff (Earth-616)', 'Black Widow', 'Чёрная вдова', 'Чорна вдова', F, HERO, ['Мстители', 'Щ.И.Т.'], ['Боевые навыки'], 'Человек', 1964],
  ['Clinton Barton (Earth-616)', 'Hawkeye', 'Соколиный глаз', 'Соколине око', M, HERO, ['Мстители'], ['Стрельба', 'Боевые навыки'], 'Человек', 1964],
  ['Peter Parker (Earth-616)', 'Spider-Man', 'Человек-паук', 'Людина-павук', M, HERO, ['Мстители'], ['Сила', 'Ловкость'], 'Человек', 1962],
  ['Stephen Strange (Earth-616)', 'Doctor Strange', 'Доктор Стрэндж', 'Доктор Стрендж', M, HERO, ['Защитники'], ['Магия', 'Полёт'], 'Человек', 1963],
  ["T'Challa (Earth-616)", 'Black Panther', 'Чёрная пантера', 'Чорна пантера', M, HERO, ['Мстители'], ['Сила', 'Боевые навыки'], 'Человек', 1966],
  ['Scott Lang (Earth-616)', 'Ant-Man', 'Человек-муравей', 'Людина-мураха', M, HERO, ['Мстители'], ['Изменение размера', 'Технологии'], 'Человек', 1979],
  ['Janet Van Dyne (Earth-616)', 'Wasp', 'Оса', 'Оса', F, HERO, ['Мстители'], ['Изменение размера', 'Полёт'], 'Человек', 1963],
  ['Carol Danvers (Earth-616)', 'Captain Marvel', 'Капитан Марвел', 'Капітан Марвел', F, HERO, ['Мстители'], ['Сила', 'Полёт', 'Энергия'], 'Человек', 1968],
  ['Wanda Maximoff (Earth-616)', 'Scarlet Witch', 'Алая ведьма', 'Багряна відьма', F, ANTI, ['Мстители', 'Братство мутантов'], ['Магия', 'Телекинез'], 'Мутант', 1964],
  ['Pietro Maximoff (Earth-616)', 'Quicksilver', 'Ртуть', 'Ртуть', M, ANTI, ['Мстители', 'Братство мутантов'], ['Скорость'], 'Мутант', 1964],
  ['Vision (Earth-616)', 'Vision', 'Вижн', 'Віжн', M, HERO, ['Мстители'], ['Полёт', 'Энергия', 'Технологии'], 'Андроид', 1968],
  ['Samuel Wilson (Earth-616)', 'Falcon', 'Сокол', 'Сокіл', M, HERO, ['Мстители'], ['Полёт', 'Технологии'], 'Человек', 1969],
  ['James Barnes (Earth-616)', 'Winter Soldier', 'Зимний солдат', 'Зимовий солдат', M, ANTI, ['Мстители'], ['Сила', 'Боевые навыки'], 'Человек', 1941],
  ['Nicholas Fury (Earth-616)', 'Nick Fury', 'Ник Фьюри', 'Нік Ф’юрі', M, HERO, ['Щ.И.Т.'], ['Боевые навыки', 'Стрельба'], 'Человек', 1963],
  ['Peter Quill (Earth-616)', 'Star-Lord', 'Звёздный лорд', 'Зоряний лорд', M, HERO, ['Стражи Галактики'], ['Стрельба', 'Полёт'], 'Человек', 1976],
  ['Gamora (Earth-616)', 'Gamora', 'Гамора', 'Гамора', F, HERO, ['Стражи Галактики'], ['Боевые навыки', 'Сила'], 'Инопланетянин', 1975],
  ['Arthur Douglas (Earth-616)', 'Drax the Destroyer', 'Дракс Разрушитель', 'Дракс Руйнівник', M, HERO, ['Стражи Галактики'], ['Сила'], 'Инопланетянин', 1973],
  ['Rocket Raccoon (Earth-616)', 'Rocket', 'Ракета', 'Ракета', M, HERO, ['Стражи Галактики'], ['Технологии', 'Стрельба'], 'Существо', 1976],
  ['Groot (Earth-616)', 'Groot', 'Грут', 'Грут', M, HERO, ['Стражи Галактики'], ['Сила', 'Регенерация'], 'Инопланетянин', 1960],
  ['Nebula (Earth-616)', 'Nebula', 'Небула', 'Небула', F, ANTI, ['Стражи Галактики'], ['Боевые навыки', 'Технологии'], 'Инопланетянин', 1985],
  ['Mantis (Earth-616)', 'Mantis', 'Мантис', 'Мантіс', F, HERO, ['Стражи Галактики'], ['Телепатия', 'Боевые навыки'], 'Человек', 1973],
  ['Yondu Udonta (Earth-616)', 'Yondu', 'Йонду', 'Йонду', M, ANTI, ['Стражи Галактики'], ['Боевые навыки'], 'Инопланетянин', 1969],
  ['Thanos (Earth-616)', 'Thanos', 'Танос', 'Танос', M, VILLAIN, ['Чёрный орден'], ['Сила', 'Энергия'], 'Инопланетянин', 1973],
  ['Loki Laufeyson (Earth-616)', 'Loki', 'Локи', 'Локі', M, ANTI, ['Одиночка'], ['Магия', 'Иллюзии'], 'Асгардиец', 1949],
  ['Victor von Doom (Earth-616)', 'Doctor Doom', 'Доктор Дум', 'Доктор Дум', M, VILLAIN, ['Одиночка'], ['Магия', 'Технологии'], 'Человек', 1962],
  ['Max Eisenhardt (Earth-616)', 'Magneto', 'Магнето', 'Магнето', M, ANTI, ['Братство мутантов', 'Люди Икс'], ['Магнетизм', 'Полёт'], 'Мутант', 1963],
  ['Charles Xavier (Earth-616)', 'Professor X', 'Профессор Икс', 'Професор Ікс', M, HERO, ['Люди Икс'], ['Телепатия'], 'Мутант', 1963],
  ['James Howlett (Earth-616)', 'Wolverine', 'Росомаха', 'Росомаха', M, ANTI, ['Люди Икс', 'Мстители'], ['Регенерация', 'Боевые навыки'], 'Мутант', 1974],
  ['Scott Summers (Earth-616)', 'Cyclops', 'Циклоп', 'Циклоп', M, HERO, ['Люди Икс'], ['Энергия'], 'Мутант', 1963],
  ['Jean Grey (Earth-616)', 'Jean Grey', 'Джина Грей', 'Джина Ґрей', F, HERO, ['Люди Икс'], ['Телепатия', 'Телекинез'], 'Мутант', 1963],
  ['Ororo Munroe (Earth-616)', 'Storm', 'Шторм', 'Шторм', F, HERO, ['Люди Икс'], ['Погода', 'Полёт'], 'Мутант', 1975],
  ['Henry McCoy (Earth-616)', 'Beast', 'Зверь', 'Звір', M, HERO, ['Люди Икс', 'Мстители'], ['Сила', 'Ловкость'], 'Мутант', 1963],
  ['Robert Drake (Earth-616)', 'Iceman', 'Ледяной человек', 'Крижана людина', M, HERO, ['Люди Икс'], ['Лёд'], 'Мутант', 1963],
  ['Raven Darkholme (Earth-616)', 'Mystique', 'Мистик', 'Містик', F, VILLAIN, ['Братство мутантов'], ['Перевоплощение'], 'Мутант', 1978],
  ['Kurt Wagner (Earth-616)', 'Nightcrawler', 'Ночной змей', 'Нічний змій', M, HERO, ['Люди Икс'], ['Телепортация', 'Ловкость'], 'Мутант', 1975],
  ['Remy LeBeau (Earth-616)', 'Gambit', 'Гамбит', 'Гамбіт', M, ANTI, ['Люди Икс'], ['Энергия', 'Боевые навыки'], 'Мутант', 1990],
  ['Anna Marie (Earth-616)', 'Rogue', 'Роуг', 'Роуг', F, HERO, ['Люди Икс'], ['Сила', 'Полёт', 'Поглощение'], 'Мутант', 1981],
  ['Piotr Rasputin (Earth-616)', 'Colossus', 'Колосс', 'Колос', M, HERO, ['Люди Икс'], ['Сила', 'Неуязвимость'], 'Мутант', 1975],
  ['Katherine Pryde (Earth-616)', 'Kitty Pryde', 'Китти Прайд', 'Кітті Прайд', F, HERO, ['Люди Икс'], ['Проницаемость'], 'Мутант', 1980],
  ['Wade Wilson (Earth-616)', 'Deadpool', 'Дэдпул', 'Дедпул', M, ANTI, ['Одиночка'], ['Регенерация', 'Боевые навыки'], 'Мутант', 1991],
  ['Reed Richards (Earth-616)', 'Mister Fantastic', 'Мистер Фантастик', 'Містер Фантастик', M, HERO, ['Фантастическая четвёрка'], ['Растяжение', 'Технологии'], 'Человек', 1961],
  ['Susan Storm (Earth-616)', 'Invisible Woman', 'Невидимая леди', 'Невидима леді', F, HERO, ['Фантастическая четвёрка'], ['Невидимость', 'Силовые поля'], 'Человек', 1961],
  ['Jonathan Storm (Earth-616)', 'Human Torch', 'Человек-факел', 'Людина-смолоскип', M, HERO, ['Фантастическая четвёрка'], ['Огонь', 'Полёт'], 'Человек', 1961],
  ['Benjamin Grimm (Earth-616)', 'Thing', 'Существо', 'Істота', M, HERO, ['Фантастическая четвёрка'], ['Сила', 'Неуязвимость'], 'Существо', 1961],
  ['Matthew Murdock (Earth-616)', 'Daredevil', 'Сорвиголова', 'Шибайголова', M, HERO, ['Защитники'], ['Чутьё', 'Боевые навыки'], 'Человек', 1964],
  ['Frank Castle (Earth-616)', 'Punisher', 'Каратель', 'Каратель', M, ANTI, ['Одиночка'], ['Стрельба', 'Боевые навыки'], 'Человек', 1974],
  ['Jessica Jones (Earth-616)', 'Jessica Jones', 'Джессика Джонс', 'Джессіка Джонс', F, HERO, ['Защитники'], ['Сила', 'Полёт'], 'Человек', 2001],
  ['Luke Cage (Earth-616)', 'Luke Cage', 'Люк Кейдж', 'Люк Кейдж', M, HERO, ['Защитники'], ['Сила', 'Неуязвимость'], 'Человек', 1972],
  ['Daniel Rand (Earth-616)', 'Iron Fist', 'Железный кулак', 'Залізний кулак', M, HERO, ['Защитники'], ['Боевые навыки', 'Энергия'], 'Человек', 1974],
  ['Marc Spector (Earth-616)', 'Moon Knight', 'Лунный рыцарь', 'Місячний лицар', M, ANTI, ['Одиночка'], ['Боевые навыки', 'Магия'], 'Человек', 1975],
  ['Edward Brock (Earth-616)', 'Venom', 'Веном', 'Веном', M, ANTI, ['Одиночка'], ['Сила', 'Регенерация'], 'Симбиот', 1988],
  ['Cletus Kasady (Earth-616)', 'Carnage', 'Карнаж', 'Карнаж', M, VILLAIN, ['Одиночка'], ['Сила', 'Регенерация'], 'Симбиот', 1991],
  ['Norman Osborn (Earth-616)', 'Green Goblin', 'Зелёный гоблин', 'Зелений гоблін', M, VILLAIN, ['Одиночка'], ['Сила', 'Полёт', 'Технологии'], 'Человек', 1964],
  ['Otto Octavius (Earth-616)', 'Doctor Octopus', 'Доктор Осьминог', 'Доктор Восьминіг', M, VILLAIN, ['Зловещая шестёрка'], ['Технологии'], 'Человек', 1963],
  ['Maxwell Dillon (Earth-616)', 'Electro', 'Электро', 'Електро', M, VILLAIN, ['Зловещая шестёрка'], ['Энергия', 'Полёт'], 'Человек', 1964],
  ['Flint Marko (Earth-616)', 'Sandman', 'Песочный человек', 'Піщана людина', M, VILLAIN, ['Зловещая шестёрка'], ['Перевоплощение', 'Сила'], 'Человек', 1963],
  ['Sergei Kravinoff (Earth-616)', 'Kraven the Hunter', 'Крэйвен-охотник', 'Крейвен-мисливець', M, VILLAIN, ['Зловещая шестёрка'], ['Боевые навыки', 'Чутьё'], 'Человек', 1964],
  ['MacDonald Gargan (Earth-616)', 'Scorpion', 'Скорпион', 'Скорпіон', M, VILLAIN, ['Зловещая шестёрка'], ['Сила', 'Технологии'], 'Человек', 1964],
  ['Adrian Toomes (Earth-616)', 'Vulture', 'Стервятник', 'Стерв’ятник', M, VILLAIN, ['Зловещая шестёрка'], ['Полёт', 'Технологии'], 'Человек', 1963],
  ['Gwendolyn Stacy (Earth-65)', 'Spider-Gwen', 'Гвен-паук', 'Гвен-павук', F, HERO, ['Одиночка'], ['Сила', 'Ловкость'], 'Человек', 2014],
  ['Miles Morales (Earth-1610)', 'Miles Morales', 'Майлз Моралес', 'Майлз Моралес', M, HERO, ['Мстители'], ['Сила', 'Невидимость'], 'Человек', 2011],
  ['Ultron (Earth-616)', 'Ultron', 'Альтрон', 'Альтрон', M, VILLAIN, ['Одиночка'], ['Технологии', 'Полёт', 'Энергия'], 'Андроид', 1968],
  ['Erik Killmonger (Earth-616)', 'Killmonger', 'Киллмонгер', 'Кіллмонґер', M, VILLAIN, ['Одиночка'], ['Боевые навыки'], 'Человек', 1973],
  ['Hela (Earth-616)', 'Hela', 'Хела', 'Хела', F, VILLAIN, ['Одиночка'], ['Магия', 'Сила'], 'Асгардиец', 1964],
  ['Heimdall (Earth-616)', 'Heimdall', 'Хеймдалль', 'Хеймдалль', M, HERO, ['Одиночка'], ['Чутьё', 'Сила'], 'Асгардиец', 1962],
  ['Brunnhilde (Earth-616)', 'Valkyrie', 'Валькирия', 'Валькірія', F, HERO, ['Мстители'], ['Сила', 'Полёт'], 'Асгардиец', 1970],
  ['Odin Borson (Earth-616)', 'Odin', 'Один', 'Одін', M, HERO, ['Одиночка'], ['Магия', 'Сила'], 'Асгардиец', 1962],
  ['Wilson Fisk (Earth-616)', 'Kingpin', 'Кингпин', 'Кінґпін', M, VILLAIN, ['Одиночка'], ['Сила', 'Боевые навыки'], 'Человек', 1967],
  ['Sam Alexander (Earth-616)', 'Nova', 'Нова', 'Нова', M, HERO, ['Мстители'], ['Полёт', 'Энергия'], 'Человек', 2011],
  ['Kamala Khan (Earth-616)', 'Ms. Marvel', 'Мисс Марвел', 'Міс Марвел', F, HERO, ['Мстители'], ['Растяжение', 'Изменение размера'], 'Нелюдь', 2013],
  ['Shang-Chi (Earth-616)', 'Shang-Chi', 'Шан-Чи', 'Шан-Чі', M, HERO, ['Мстители'], ['Боевые навыки'], 'Человек', 1973],
  ['Elektra Natchios (Earth-616)', 'Elektra', 'Электра', 'Електра', F, ANTI, ['Одиночка'], ['Боевые навыки'], 'Человек', 1981],
  ['Jennifer Walters (Earth-616)', 'She-Hulk', 'Женщина-Халк', 'Жінка-Галк', F, HERO, ['Мстители'], ['Сила', 'Регенерация'], 'Мутант', 1980],
  ['Robert Reynolds (Earth-616)', 'Sentry', 'Часовой', 'Вартовий', M, ANTI, ['Мстители'], ['Сила', 'Полёт', 'Энергия'], 'Человек', 2000],
  ['Monica Rambeau (Earth-616)', 'Photon', 'Фотон', 'Фотон', F, HERO, ['Мстители'], ['Энергия', 'Полёт'], 'Человек', 1982],
  ['Riri Williams (Earth-616)', 'Ironheart', 'Железное сердце', 'Залізне серце', F, HERO, ['Мстители'], ['Технологии', 'Полёт'], 'Человек', 2016],
  ['Katherine Bishop (Earth-616)', 'Kate Bishop', 'Кейт Бишоп', 'Кейт Бішоп', F, HERO, ['Мстители'], ['Стрельба', 'Боевые навыки'], 'Человек', 2005],
  ['Yelena Belova (Earth-616)', 'Yelena Belova', 'Елена Белова', 'Олена Бєлова', F, ANTI, ['Мстители'], ['Боевые навыки'], 'Человек', 1999],
  ['Namor McKenzie (Earth-616)', 'Namor', 'Нэмор', 'Немор', M, ANTI, ['Защитники'], ['Сила', 'Полёт', 'Вода'], 'Нелюдь', 1939],
  ['Blackagar Boltagon (Earth-616)', 'Black Bolt', 'Чёрный Гром', 'Чорний Грім', M, HERO, ['Нелюди'], ['Энергия', 'Полёт'], 'Нелюдь', 1965],
  ['Medusalith Amaquelin (Earth-616)', 'Medusa', 'Медуза', 'Медуза', F, HERO, ['Нелюди'], ['Волосы', 'Боевые навыки'], 'Нелюдь', 1965],
  ['Johnathon Blaze (Earth-616)', 'Ghost Rider', 'Призрачный гонщик', 'Примарний гонщик', M, ANTI, ['Одиночка'], ['Огонь', 'Магия'], 'Существо', 1972],
  ['Eric Brooks (Earth-616)', 'Blade', 'Блэйд', 'Блейд', M, ANTI, ['Одиночка'], ['Боевые навыки', 'Регенерация'], 'Существо', 1973],
  ['Thaddeus Ross (Earth-616)', 'Thunderbolt Ross', 'Таддеус Росс', 'Тадеус Росс', M, ANTI, ['Щ.И.Т.'], ['Боевые навыки'], 'Человек', 1962],
  ['Maria Hill (Earth-616)', 'Maria Hill', 'Мария Хилл', 'Марія Гілл', F, HERO, ['Щ.И.Т.'], ['Стрельба', 'Боевые навыки'], 'Человек', 2004],
  ['Phillip Coulson (Earth-616)', 'Phil Coulson', 'Фил Колсон', 'Філ Колсон', M, HERO, ['Щ.И.Т.'], ['Стрельба'], 'Человек', 2011],
  ['Peggy Carter (Earth-616)', 'Peggy Carter', 'Пегги Картер', 'Пеґґі Картер', F, HERO, ['Щ.И.Т.'], ['Боевые навыки', 'Стрельба'], 'Человек', 1966],
  ['Helmut Zemo (Earth-616)', 'Baron Zemo', 'Барон Земо', 'Барон Земо', M, VILLAIN, ['Тандерболты'], ['Боевые навыки'], 'Человек', 1973],
  ['Johann Shmidt (Earth-616)', 'Red Skull', 'Красный череп', 'Червоний череп', M, VILLAIN, ['Гидра'], ['Боевые навыки'], 'Человек', 1941],
  ['Obadiah Stane (Earth-616)', 'Iron Monger', 'Железный торговец', 'Залізний торговець', M, VILLAIN, ['Одиночка'], ['Технологии', 'Сила'], 'Человек', 1982],
  ['Ebony Maw (Earth-616)', 'Ebony Maw', 'Эбони Мо', 'Ебоні Мо', M, VILLAIN, ['Чёрный орден'], ['Телекинез', 'Телепатия'], 'Инопланетянин', 2013],
  ['Ronan (Earth-616)', 'Ronan the Accuser', 'Ронан Обвинитель', 'Ронан Обвинувач', M, VILLAIN, ['Одиночка'], ['Сила', 'Энергия'], 'Инопланетянин', 1967],
  ['Galactus (Earth-616)', 'Galactus', 'Галактус', 'Ґалактус', M, VILLAIN, ['Одиночка'], ['Энергия', 'Сила'], 'Существо', 1966],
  ['Norrin Radd (Earth-616)', 'Silver Surfer', 'Серебряный сёрфер', 'Срібний серфер', M, HERO, ['Одиночка'], ['Полёт', 'Энергия'], 'Инопланетянин', 1966],
  ['En Sabah Nur (Earth-616)', 'Apocalypse', 'Апокалипсис', 'Апокаліпсис', M, VILLAIN, ['Одиночка'], ['Сила', 'Перевоплощение'], 'Мутант', 1986],
  ['Nathaniel Essex (Mister Sinister) (Earth-616)', 'Mister Sinister', 'Мистер Зловещий', 'Містер Зловісний', M, VILLAIN, ['Одиночка'], ['Перевоплощение', 'Технологии'], 'Мутант', 1987],
  ['Emma Frost (Earth-616)', 'Emma Frost', 'Эмма Фрост', 'Емма Фрост', F, ANTI, ['Люди Икс', 'Клуб Адского пламени'], ['Телепатия', 'Неуязвимость'], 'Мутант', 1980],
  ['Laura Kinney (Earth-616)', 'X-23', 'Икс-23', 'Ікс-23', F, ANTI, ['Люди Икс'], ['Регенерация', 'Боевые навыки'], 'Мутант', 2004],
  ['Lorna Dane (Earth-616)', 'Polaris', 'Полярис', 'Полярис', F, HERO, ['Люди Икс'], ['Магнетизм'], 'Мутант', 1968],
  ['Warren Worthington III (Earth-616)', 'Angel', 'Ангел', 'Янгол', M, HERO, ['Люди Икс'], ['Полёт'], 'Мутант', 1963],
  ['Cain Marko (Earth-616)', 'Juggernaut', 'Джаггернаут', 'Джаґернаут', M, VILLAIN, ['Братство мутантов'], ['Сила', 'Неуязвимость'], 'Человек', 1965],
  ['James Rhodes (Earth-616)', 'War Machine', 'Воитель', 'Воїн', M, HERO, ['Мстители'], ['Технологии', 'Полёт', 'Стрельба'], 'Человек', 1979],
  ['Henry Pym (Earth-616)', 'Hank Pym', 'Хэнк Пим', 'Генк Пім', M, HERO, ['Мстители'], ['Изменение размера', 'Технологии'], 'Человек', 1962],
  ['Shuri (Earth-616)', 'Shuri', 'Шури', 'Шурі', F, HERO, ['Мстители'], ['Технологии', 'Боевые навыки'], 'Человек', 2005],
  ['Jane Foster (Earth-616)', 'Mighty Thor', 'Могучая Тор', 'Могутня Тор', F, HERO, ['Мстители'], ['Сила', 'Полёт', 'Магия'], 'Человек', 1962],
  ['Beta Ray Bill (Earth-616)', 'Beta Ray Bill', 'Бета Рэй Билл', 'Бета Рей Білл', M, HERO, ['Одиночка'], ['Сила', 'Полёт', 'Магия'], 'Инопланетянин', 1983],
  ['Jonathan Walker (Earth-616)', 'U.S. Agent', 'Эй-Джент', 'Ю. Ес. Ейджент', M, ANTI, ['Тандерболты'], ['Сила', 'Боевые навыки'], 'Человек', 1986],
  ['Roberto Reyes (Earth-616)', 'Robbie Reyes', 'Робби Рейес', 'Роббі Реєс', M, ANTI, ['Мстители'], ['Огонь', 'Магия'], 'Существо', 2014],
  ['Emil Blonsky (Earth-616)', 'Abomination', 'Мерзость', 'Мерзота', M, VILLAIN, ['Одиночка'], ['Сила', 'Регенерация'], 'Мутант', 1967],
  ['Mar-Vell (Earth-616)', 'Mar-Vell', 'Мар-Велл', 'Мар-Велл', M, HERO, ['Одиночка'], ['Полёт', 'Энергия'], 'Инопланетянин', 1967],
  ["Miguel O'Hara (Earth-928)", 'Spider-Man 2099', 'Человек-паук 2099', 'Людина-павук 2099', M, HERO, ['Одиночка'], ['Сила', 'Ловкость'], 'Мутант', 1992],
  ['Benjamin Reilly (Earth-616)', 'Scarlet Spider', 'Алый паук', 'Багряний павук', M, HERO, ['Одиночка'], ['Сила', 'Ловкость'], 'Человек', 1975],
  ['Cindy Moon (Earth-616)', 'Silk', 'Шёлк', 'Шовк', F, HERO, ['Одиночка'], ['Сила', 'Ловкость'], 'Человек', 2014],
  ['Jessica Drew (Earth-616)', 'Spider-Woman', 'Женщина-паук', 'Жінка-павук', F, HERO, ['Мстители'], ['Полёт', 'Энергия'], 'Человек', 1977],
  ['Peter Porker (Earth-8311)', 'Spider-Ham', 'Спайдер-Хэм', 'Спайдер-Хем', M, HERO, ['Одиночка'], ['Сила', 'Ловкость'], 'Существо', 1983],
  ['Pavitr Prabhakar (Earth-50101)', 'Spider-Man India', 'Человек-паук Индия', 'Людина-павук Індія', M, HERO, ['Одиночка'], ['Сила', 'Ловкость'], 'Человек', 2004],
  ['Peter Parker (Earth-90214)', 'Spider-Man Noir', 'Человек-паук Нуар', 'Людина-павук Нуар', M, HERO, ['Одиночка'], ['Ловкость', 'Стрельба'], 'Человек', 2009],
  ['Eugene Thompson (Earth-616)', 'Agent Venom', 'Агент Веном', 'Агент Веном', M, ANTI, ['Тандерболты'], ['Сила', 'Стрельба'], 'Симбиот', 1962],
  ['Venom (Symbiote) (Earth-616)', 'Venom Symbiote', 'Симбиот Веном', 'Симбіот Веном', M, ANTI, ['Одиночка'], ['Перевоплощение', 'Регенерация'], 'Симбиот', 1984],
  ['America Chavez (Earth-616)', 'America Chavez', 'Америка Чавес', 'Америка Чавес', F, HERO, ['Мстители'], ['Сила', 'Полёт'], 'Инопланетянин', 2011],
  ['Doreen Green (Earth-616)', 'Squirrel Girl', 'Девушка-белка', 'Дівчина-білка', F, HERO, ['Мстители'], ['Сила', 'Ловкость'], 'Мутант', 1992],
  ['Wong (Earth-616)', 'Wong', 'Вонг', 'Вонг', M, HERO, ['Защитники'], ['Магия', 'Боевые навыки'], 'Человек', 1963],
  ['Virginia Potts (Earth-616)', 'Pepper Potts', 'Пеппер Поттс', 'Пеппер Поттс', F, HERO, ['Мстители'], ['Технологии', 'Полёт'], 'Человек', 1963],
  ['Nathan Summers (Earth-616)', 'Cable', 'Кейбл', 'Кейбл', M, ANTI, ['Люди Икс'], ['Телекинез', 'Стрельба'], 'Мутант', 1986],
  ['Elizabeth Braddock (Earth-616)', 'Psylocke', 'Псайлок', 'Псайлок', F, HERO, ['Люди Икс'], ['Телепатия', 'Боевые навыки'], 'Мутант', 1976],
  ['Lucas Bishop (Earth-1191)', 'Bishop', 'Бишоп', 'Бішоп', M, HERO, ['Люди Икс'], ['Поглощение', 'Стрельба'], 'Мутант', 1991],
  ['Victor Creed (Earth-616)', 'Sabretooth', 'Саблезубый', 'Шаблезубий', M, VILLAIN, ['Братство мутантов'], ['Регенерация', 'Чутьё'], 'Мутант', 1977],
  ['Jubilation Lee (Earth-616)', 'Jubilee', 'Джубили', 'Джубілі', F, HERO, ['Люди Икс'], ['Энергия'], 'Мутант', 1989],
  ['Michael Morbius (Earth-616)', 'Morbius', 'Морбиус', 'Морбіус', M, ANTI, ['Одиночка'], ['Регенерация', 'Полёт'], 'Существо', 1971],
  ['Quentin Beck (Earth-616)', 'Mysterio', 'Мистерио', 'Містеріо', M, VILLAIN, ['Зловещая шестёрка'], ['Иллюзии', 'Технологии'], 'Человек', 1964],
  ['Curtis Connors (Earth-616)', 'Lizard', 'Ящер', 'Ящір', M, VILLAIN, ['Одиночка'], ['Сила', 'Регенерация'], 'Существо', 1963],
  ['Aleksei Sytsevich (Earth-616)', 'Rhino', 'Носорог', 'Носоріг', M, VILLAIN, ['Зловещая шестёрка'], ['Сила', 'Неуязвимость'], 'Человек', 1966],
  ['Bullseye (Lester) (Earth-616)', 'Bullseye', 'Меченый', 'Мічений', M, VILLAIN, ['Одиночка'], ['Стрельба', 'Боевые навыки'], 'Человек', 1976],
  ['Zebediah Killgrave (Earth-616)', 'Purple Man', 'Пурпурный человек', 'Пурпурова людина', M, VILLAIN, ['Одиночка'], ['Телепатия'], 'Человек', 1964],
  ['Felicia Hardy (Earth-616)', 'Black Cat', 'Чёрная кошка', 'Чорна кішка', F, ANTI, ['Одиночка'], ['Ловкость', 'Боевые навыки'], 'Человек', 1979],
  ['Adam Warlock (Earth-616)', 'Adam Warlock', 'Адам Уорлок', 'Адам Ворлок', M, HERO, ['Стражи Галактики'], ['Энергия', 'Полёт'], 'Инопланетянин', 1967],
  ['Herbert Wyndham (Earth-616)', 'High Evolutionary', 'Высший Эволюционер', 'Вищий Еволюціонер', M, VILLAIN, ['Одиночка'], ['Технологии', 'Энергия'], 'Человек', 1966],
  ['Nathaniel Richards (Kang) (Earth-6311)', 'Kang the Conqueror', 'Канг Завоеватель', 'Канґ Завойовник', M, VILLAIN, ['Одиночка'], ['Технологии', 'Энергия'], 'Человек', 1964],
  ['Agatha Harkness (Earth-616)', 'Agatha Harkness', 'Агата Харкнесс', 'Аґата Гаркнесс', F, VILLAIN, ['Одиночка'], ['Магия'], 'Человек', 1970],
  ['Arnim Zola (Earth-616)', 'Arnim Zola', 'Арним Зола', 'Арнім Зола', M, VILLAIN, ['Гидра'], ['Технологии'], 'Андроид', 1977],
  ['Brock Rumlow (Earth-616)', 'Crossbones', 'Кроссбоунс', 'Кросбоунз', M, VILLAIN, ['Гидра'], ['Боевые навыки', 'Стрельба'], 'Человек', 1989],
  ['Anthony Masters (Earth-616)', 'Taskmaster', 'Таскмастер', 'Таскмайстер', M, VILLAIN, ['Тандерболты'], ['Боевые навыки', 'Стрельба'], 'Человек', 1980],
  ['Dormammu (Earth-616)', 'Dormammu', 'Дормамму', 'Дормамму', M, VILLAIN, ['Одиночка'], ['Магия', 'Энергия'], 'Существо', 1964],
  ['Mephisto (Earth-616)', 'Mephisto', 'Мефисто', 'Мефісто', M, VILLAIN, ['Одиночка'], ['Магия', 'Иллюзии'], 'Существо', 1968],
  ['Sersi (Earth-616)', 'Sersi', 'Серси', 'Серсі', F, HERO, ['Мстители'], ['Магия', 'Перевоплощение'], 'Инопланетянин', 1976],
  ['Ikaris (Earth-616)', 'Ikaris', 'Икарис', 'Ікаріс', M, HERO, ['Одиночка'], ['Полёт', 'Энергия'], 'Инопланетянин', 1976],
]

async function main() {
  await fs.mkdir(path.join(CACHE, 'img'), { recursive: true })
  await fs.mkdir(THUMBS, { recursive: true })
  await fs.mkdir(path.join(OUT_IMG, 'full'), { recursive: true })

  const titles = [...new Set(ROSTER.map(([t]) => t.split('#')[0]))]
  const pages = await cachedJson(CACHE, 'pages.json', () => wikiPages(API, titles))
  const images = await cachedJson(CACHE, 'images.json', async () => {
    const res = await wikiQuery(API, titles, 'prop=pageimages&piprop=original')
    return Object.fromEntries(Object.entries(res).map(([t, p]) => [t, p.original?.source ?? null]))
  })

  const chosen = await cachedJson(CACHE, 'chosen.json', () => wikiImageUrls(API, [...new Set(Object.values(PICK))]))

  const result = []
  const missing = []
  await pool(
    ROSTER.map((row, index) => ({ row, index })),
    6,
    async ({ row, index }) => {
    const [title, nameEn, nameRu, nameUk, gender, side, teams, powers, species, year] = row
    const base = title.split('#')[0]
    const page = pages[base]
    const sources = [PICK[nameEn] ? chosen[PICK[nameEn]] : null, images[base]].filter(Boolean)
    if (!page?.id || !sources.length) return missing.push(nameEn)
    const key = `${page.id}-${nameEn.replace(/\W+/g, '')}`
    const buf = await cachedDownload(path.join(CACHE, 'img'), key, sources)
    if (!buf) return missing.push(nameEn)
    const id = index + 1
    try {
      await writeFullAndThumb(buf, path.join(OUT_IMG, 'full', `${id}.webp`), path.join(THUMBS, `${id}.webp`), 96)
    } catch (error) {
      return missing.push(`${nameEn} (${error.message})`)
    }
    result.push({ id, name: nameRu, nameEn, nameUk, gender, side, teams, powers, species, debut: String(year), debutIndex: year, answer: true })
    },
  )

  dropDeleted(result, 'marvel')
  onlyAnswers(result)
  result.sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  await writeAtlas(result, THUMBS, path.join(OUT_IMG, 'thumbs.webp'), OUT_ATLAS, 12, 96)
  await pruneImages(path.join(OUT_IMG, 'full'), result)
  await fs.writeFile(OUT_JSON, JSON.stringify(result, null, 1))
  console.log(`wrote ${result.length} heroes`)
  if (missing.length) console.warn(`no image for ${missing.length}:`, missing.join(', '))
}

main()
