# ARCHITECTURE — Корень Живознания

## 1. Цель

Кодовая база должна позволять развивать стратегическую RPG маленькими независимыми шагами и отлаживать всю игровую математику без браузера и без визуального слоя.

## 2. Главная граница

`src/core/**` — единственный источник истины о состоянии и правилах игры.

UI и будущий Phaser:

- отправляют намерения/команды;
- получают `CommandResult` и visualization DTO;
- ничего не решают о победителях, налогах, снабжении, владельцах городов или ИИ.

Phaser никогда не читает `GameState` напрямую. Для `src/phaser/**` действует ESLint-запрет импорта `src/core/**`.

## 3. Слои

### core

Чистый TypeScript: состояние, команды, карта, экономика, бои, ИИ, события, RNG, сейвы. По возможности без DOM и React.

### data

Контент: карты, лидеры, фракции, юниты, события. Контент описывается данными, не ветвлениями по id.

### ui

React: экраны, панели, кнопки, стратегическая SVG-карта, presentation state.

### phaser

Появится позже. Только проигрывание `VisualizationData`/battle timeline и ввод, который возвращается в UI/command layer.

### services

Периферия приложения. Например, аудио. Для систем, которые пока не реализованы, допускаются стабильные no-op интерфейсы.

## 4. Поток изменения игры

```text
User/AI intent
  -> GameCommand
  -> pure simulation
  -> CommandResult { state, events }
  -> app stores new GameState
  -> React renders selectors
  -> visualizer gets flat DTO/events
```

UI не должен вычислять game rules сравнением старого и нового состояния: для обратной связи используются `GameEvent[]`.

## 5. Состояние

Один сериализуемый `GameState`. Критическое состояние нельзя прятать в React-компонентах, canvas/Phaser scenes или singleton-сервисах.

Presentation state (выбранная карточка, открытая панель, hover) в GameState не хранится.

Ресурсы принадлежат фракциям (`FactionState.resources`), а не глобальному игроку. Владение городами имеет единственный источник истины — `CityState.ownerFactionId`. Это позволяет игроку и ИИ использовать одинаковые команды движения, найма и экономики без рассинхронизации списков владения.

`FactionState.strategicActionSpent` — минимальная модель action economy для MVP-0: каждая фракция независимо получает одно значимое стратегическое действие на ход. Информационные действия React UI его не меняют. Это позволяет игроку и ИИ использовать одинаковые команды без обходов правил.

## 6. RNG

В GameState хранится не только seed, а `RngState { seed, cursor }`.

Потоки независимы:

- `campaign` — ход, экономика, стратегические эффекты;
- `battles` — боевая симуляция;
- `events` — кампанийные события.

Новый случайный вызов в экономике не должен менять будущий результат фиксированного боя.

## 7. Модификаторы

Контент не проверяется через `if (leader.id === ...)`.

```ts
type Modifier = {
  target: ModifierTarget;
  op: 'add' | 'mul';
  value: number;
  source: string;
};
```

Порядок: все `add`, затем все `mul`. Для `mul` значение — коэффициент (`1.10` = +10%). Допустимые targets централизованы.

## 8. Бой

Один `simulateBattle(...)` с `scale: 'skirmish' | 'battle'` обслуживает оба масштаба вместо двух независимых систем. Базовая математика общая; scale выбирает data-driven число раундов, интенсивность потерь и временную гранулярность timeline.

BattleSimulator получает roster, morale, tactic, unit definitions, battle rules и явный `RngState`. Он не читает `GameState` и возвращает `BattleResult`, включая продвинутый RNG state. Поэтому command layer остаётся единственным местом, которое применяет результат боя к кампании.

Лестница исходов: `victory | pyrrhic_victory | retreat | rout`. Слом строя по морали/остатку войск имеет приоритет над сравнением финального raw strength.

`BattleTimelineEvent[]` создаётся симуляцией вместе с результатом. React/Phaser не пересчитывают бой и только проигрывают timeline.

Stage 09 вводит промежуточный read-only слой `core/battles/presentation`: `buildBattlePresentation()` группирует timeline по времени и строит кадры для UI. Он не использует RNG, не читает GameState и не может менять BattleResult. Первая презентация — React/SVG с точками; позже тот же DTO может проигрываться Phaser.

## 9. Карта

Стратегическая карта — граф. На MVP используется React/SVG, а не Phaser. Для маршрутов достаточно BFS в `graphSearch.ts`.

Ребро считается двусторонним, пока конкретный тип дороги явно не задаст другое правило. На текущем прототипе армия может перемещаться только в непосредственно соседний узел. Обычный переход в city-node разрешён только если город уже контролируется фракцией армии; нейтральный/чужой город требует `attackCity`. Переход расходует припасы своей фракции и стратегическое действие.

## 9.1. Города и гарнизоны

`CityState.ownerFactionId` остаётся единственным источником владения. `CityState.garrison` хранит persistent roster + morale защитников: потери после неудачного штурма не сбрасываются.

`attackCity` — orchestration command: проверяет соседство/ресурсы/action economy, передаёт данные в чистый BattleSimulator, записывает новый battle RNG, применяет потери/мораль и при победе меняет владельца/позицию армии. UI не применяет BattleResult самостоятельно.

После захвата полевая армия занимает город, а city garrison пуст: один и тот же состав не дублируется в двух состояниях. При последующем штурме полевая армия в узле считается реальным защитником; при поражении она отступает в ближайший другой контролируемый город.

## 9.2. Армии и юниты

`ArmyState.roster` — единственный источник истины о составе. `totalUnits`, суммарная атака, защита и содержание являются производными и вычисляются селекторами `core/armies`.

Unit definitions — data-driven: роль, атака, защита и upkeep лежат в `data/units`; `core` не ветвится по конкретному `unitTypeId`. Городской найм хранит список предложений и изменяет только выбранный тип.

Содержание армий — системный end-of-turn эффект: сначала доход городов, затем upkeep. Отрицательная казна не допускается; недоплата возвращается событием для будущих последствий.


## 9.3. ИИ и полный ход

`core/factions/ai` отвечает только за оценку и выбор намерения. Само действие выполняется общими командами ядра. `advanceTurn()` оркестрирует порядок: AI turns → income → upkeep → increment turn → reset faction action budgets.

Первый AI использует локальную one-step оценку соседних целей: ценность города, риск боя и сокращение BFS-distance к центральному узлу. Многоходовое планирование намеренно отсутствует до доказательства MVP-0.

## 10. Сейвы

Файл сейва всегда обёрнут в `{ version, state }`. Любое несовместимое изменение состояния требует миграции версии.

Текущая версия: v8. Миграции v1–v7→v8 поддерживают старые prototype saves. v6 переносит action economy из CampaignState в отдельные FactionState; v7 добавляет новые Stage 12 города; v8 добавляет superFaction/traits/leader action metadata и заменяет нейтральное владение орсийскими городами на seeded распределение между внутренними группами, сохраняя уже захваченные города. Владение городами хранится только в `CityState.ownerFactionId`; дублирующий `FactionState.controlledCityIds` удалён. Legacy `ArmyState.totalUnits` мигрирует в roster пехоты без изменения общей численности. Старые сейвы, где гарнизонов ещё не существовало, получают пустой legacy-safe garrison вместо выдуманного состава.

## 11. События

Будущие `EventDefinition` не содержат функций. Условия задаются декларативным DSL и интерпретируются ядром.

## 12. MVP-0

Вертикальный срез:

- 14 городов + 6 POI + центральный узел в текущем Stage 12 prototype;
- 1 лидер;
- 1 ИИ-фракция;
- 2 типа юнитов;
- одна общая боевая система;
- 3 события;
- SVG-карта;
- полностью работающая победа/поражение.

Боевой presentation layer уже подключён через React/SVG. Автопроигрывание и при необходимости Phaser добавляются поверх него, не меняя расчёты.


## 13. Web/PWA

Ранняя исполняемая платформа — обычный Vite static build. `dist/` должен разворачиваться на Netlify без backend. Manifest + service worker обеспечивают PWA-ready слой; Capacitor подключается после browser MVP-0 и не меняет simulation architecture.


## Local developer launch

На Windows предпочтительный пользовательский запуск — `START_GAME.bat`. Он является оболочкой над Vite и не меняет архитектуру приложения.

## 14. Tactical battle presentation (Stage 11)

Боевой renderer теперь имеет два независимых read-only helper-слоя поверх BattleTimeline:

- `BattlePlayback` — непрерывное визуальное время и интерполяция между keyframes;
- `BattleFormation` — геометрия левый фланг / центр / правый фланг, front/rear lines и визуальная трактовка tactic.

`BattlePresentationSide` хранит точный `initialRoster` и текущий `roster`, восстановленный из `casualties.losses`. Поэтому placement line/ranged следует реальному составу, а не агрегатной численности.

Критическое ограничение: lane pressure, volley arcs и melee vectors не являются новыми боевыми событиями и не могут менять GameState/RNG/BattleResult. Они только отображают уже рассчитанный бой. Настоящая sector-specific математика в будущем допускается только через расширение `simulateBattle()` + BattleTimeline contract.

## 15. Supply network (Stage 13)

`core/supply` — чистый производный слой над `GameState + MapGraph`.

`getSupplyStatus(state, graph, factionId, nodeId)` ищет ближайшую контролируемую опорную точку BFS-маршрутом, который не проходит через неконтролируемые city nodes. Возвращаемый DTO содержит level, percent, distance, nearestCityId, path, actionCostMultiplier и moralePressure.

`moveArmy` применяет multiplier по projected destination status. `attackCity` применяет multiplier по status исходной позиции. `advanceTurn` применяет `applySupplyPressure` ко всем армиям перед income/upkeep reset-cycle. UI только показывает тот же DTO и supply path.

Supply status не сериализуется: смена владельца города автоматически меняет логистику без дополнительного update command.

## 16. Strategic camera and location dock (Stage 13)

Map camera (`zoom/centerX/centerY`) хранится локально в `SvgWorldMap`. Реальный граф остаётся в координатах 0..100, а камера изменяет только SVG `viewBox`. Zoom/pan не являются GameState.

Location dock использует bounded scroll: information zone может вертикально прокручиваться, action strip — горизонтально. Это защищает map-first layout от длинных descriptions, recruitment lists и feedback.
