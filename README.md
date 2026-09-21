# Narutodle — безкінечний режим

Фанатська гра на кшталт [narutodle.net](https://narutodle.net), але без обмеження «раз на день».

- **Класика** — вгадай персонажа; клітинки підсвічуються зеленим / жовтим / червоним (стать, афіліація, види дзюцу, кеккей генкай, природа чакри, атрибути, арка дебюту зі стрілкою раніше/пізніше).
- **Картинка** — вгадай персонажа за сильно збільшеним фрагментом; кожна помилка трохи віддаляє картинку.

## Запуск

```bash
npm install
npm run dev
```

## Дані

`npm run data` перезбирає `src/data/characters.json` і картинки в `public/characters/{full,thumb}`:

- персонажі та атрибути — [Dattebayo API](https://dattebayo-api.onrender.com) (дані Naruto Wiki), тільки канон манги до глави 699;
- картинки — Naruto Wiki (Fandom), з фолбеком на wiki API для битих посилань;
- пул загаданих персонажів — топ-150 за довжиною статті на вікі (щоб не загадувало епізодичних).

Кеш запитів лежить у `.cache/` (не в git). Ручні правки даних — `OVERRIDES` у `scripts/build-data.mjs`.

## Деплой

Push у `main` → GitHub Actions збирає і публікує на GitHub Pages (Settings → Pages → Source: GitHub Actions).
