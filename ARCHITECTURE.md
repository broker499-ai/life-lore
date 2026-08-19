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

`core/factions/ai` отвечает только за оценку и выбор намерения. Само действие выполняется общими командами ядра. `advanceTurn()` оркестрирует порядок: проверка terminal Root condition для AI → AI turns → проверка terminal defeat → supply pressure → income → upkeep → increment turn → reset faction action budgets.

Первый AI использует локальную one-step оценку соседних целей: ценность города, риск боя и сокращение BFS-distance к центральному узлу. Многоходовое планирование намеренно отсутствует до доказательства MVP-0.

## 10. Сейвы

Файл сейва всегда обёрнут в `{ version, state }`. Любое несовместимое изменение состояния требует миграции версии.

Текущая версия: v18. Миграции v1–v14→v15 поддерживают старые prototype saves. v6 переносит action economy из CampaignState в отдельные FactionState; v7 добавляет новые Stage 12 города; v8 добавляет superFaction/traits/leader action metadata и заменяет нейтральное владение орсийскими городами на seeded распределение между внутренними группами, сохраняя уже захваченные города; v9 добавляет pending/resolved location events и коллекцию artifact ids; v10 добавляет identity конкурирующей экспедиции и состояние завершения кампании, а legacy `meridian-company` мигрирует в `rival-expedition`; v11 добавляет persistent `campaign.discoveredNodeIds` для fog of war; v12 добавляет `completedResearchIds`, pending/resolved faction events и миграционно подключает новые data-driven traits внутренних фракций Орсии. v13 добавляет persistent `CityState.incomeMultiplier` и миграционно подключает новые traits Орков, Гоблинов и ФГУшников. v14 добавляет `campaign.cityArtifactClaimedIds`, `pendingBriefingId` и `resolvedBriefingIds`; миграция также переводит старые Stage 17 artifact/event ids на актуальные Stage 23 соответствия. v15 добавляет `FactionState.specimensCollected` и `campaign.activeArtifactIds`; миграция восстанавливает lifetime specimen progress из остатка + стоимости завершённых legacy-исследований и материализует traits первых трёх активных артефактов. v16 добавляет `campaign.extensionLocationOrder`, поздние города Профкома/Линьхао и миграционно достраивает вторую часть карты; сам порядок узлов сохраняется в GameState и не пересчитывается после загрузки. v17 добавляет `campaign.factionCapitalCityIds`: столица фиксируется как знание кампании и может отображаться сквозь fog of war независимо от последующего захвата. v18 добавляет `campaign.developerMode`; флаг действует только на player faction и снимает лимит количества стратегических действий за ход, не отменяя остальные требования и стоимость действий. Владение городами хранится только в `CityState.ownerFactionId`; дублирующий `FactionState.controlledCityIds` удалён. Legacy `ArmyState.totalUnits` мигрирует в roster пехоты без изменения общей численности. Старые сейвы, где гарнизонов ещё не существовало, получают пустой legacy-safe garrison вместо выдуманного состава.

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

Stage 31 снял прежнее ограничение presentation-only для секторов: левый фланг / центр / правый фланг теперь входят в сам `simulateBattle()` и `BattleTimeline` через sector snapshots, прорывы, резерв и окружение. Визуальные volley/melee эффекты всё ещё read-only, но sector pressure является настоящей боевой математикой.

Два вмешательства игрока не вычисляются в renderer. `BattleViewer` лишь останавливает playback перед 2-м и 4-м раундами и возвращает `BattleCommandId` в command/UI layer. CampaignScreen повторно вызывает `attackCity()` из сохранённого pre-battle `GameState` с тем же RNG seed и дополненным `BattlePlan`. Поэтому предшествующие приказу раунды остаются детерминированно теми же, а последствия приказа вычисляет только BattleSimulator.

## 15. Supply network (Stage 13)

`core/supply` — чистый производный слой над `GameState + MapGraph`.

`getSupplyStatus(state, graph, factionId, nodeId)` ищет ближайшую контролируемую опорную точку BFS-маршрутом, который не проходит через неконтролируемые city nodes. Возвращаемый DTO содержит level, percent, distance, nearestCityId, path, actionCostMultiplier и moralePressure.

`moveArmy` применяет multiplier по projected destination status. `attackCity` применяет multiplier по status исходной позиции. `advanceTurn` применяет `applySupplyPressure` ко всем армиям перед income/upkeep reset-cycle. UI только показывает тот же DTO и supply path.

Supply status не сериализуется: смена владельца города автоматически меняет логистику без дополнительного update command.

## 16. Strategic camera and location dock (Stage 13)

Map camera (`zoom/centerX/centerY`) хранится локально в `SvgWorldMap`. Реальный граф использует стабильные world-координаты внутри текущего SVG world bounds (примерно −8..108), а камера изменяет только SVG `viewBox`. Zoom/pan не являются GameState.

Location dock использует bounded scroll: information zone может вертикально прокручиваться, action strip — горизонтально. Это защищает map-first layout от длинных descriptions, recruitment lists и feedback.
## 17. Character movement presentation (Stage 17.3)

Портреты и ходьба лидеров относятся только к presentation layer. `LeaderDefinition` хранит ссылки на `portraitSrc` и data-driven `walkFrameSrcs`, но игровое ядро не знает о PNG и длительности анимации.

Для обычного перемещения порядок теперь такой:

```text
UI command
→ moveArmy(GameState)
→ successful CommandOutcome хранится как pending UI result
→ SvgWorldMap проигрывает локальную React/requestAnimationFrame анимацию
→ animation complete
→ pending result коммитится в GameState
→ triggerLocationEvent()
```

Критическое ограничение: анимация не пересчитывает движение, стоимость припасов, trait Лайоша, RNG или события. Она только задерживает визуальный commit уже рассчитанного `CommandOutcome`. Pending movement не сериализуется и не является частью save format.

Ходьба использует три PNG-кадра на лидера и отражает их по X при движении влево. Статическое состояние на узле использует отдельный прозрачный портрет.



## 18. Campaign finale and rival identity (Stage 18)

`CampaignState` хранит выбранную seeded identity конкурента (`rivalOrganizationId`, `rivalLeaderId`) и состояние завершения (`status`, `endingReason`, `endedTurn`). Внутренний faction id конкурента стабилен: `rival-expedition`. Название организации не является simulation branch.

`core/campaign/rootObjective.ts` — единственный владелец правил доступа к Корню. Центральный узел не обрабатывается обычным `moveArmy`; UI и AI используют `getRootClaimAvailability()` и `claimRoot()`. `advanceTurn()` проверяет возможность AI забрать Корень до обычного action.

`core/campaign/campaignOutcome.ts` содержит минимальные terminal conditions, независимые от renderer. Stage 18 завершает кампанию при получении Корня одной из экспедиций или при уничтожении основной армии игрока.

Battle leader portraits не входят в BattleResult/BattleTimeline. `BattleViewer` получает GameState как read-only identity context; отсутствие art для внутренних групп Орсии закрывается presentation placeholders.

## 19. Local campaign persistence and presentation-gated assaults (Stage 19)

`services/saves/CampaignStorage.ts` является внешним persistence adapter поверх `core/saves/saveFile.ts`. Он не вводит второй игровой state: в localStorage записывается строка `serializeGame(GameState)` плюс безопасный UI snapshot. Основной слот имеет один previous-state backup; UI-only updates не ротируют backup.

Загрузка всегда проходит через `deserializeGame()`, поэтому migration chain v1→v14 остаётся единственным механизмом совместимости GameState. Повреждение primary slot не блокирует valid backup.

Walking animation штурма является presentation gate: `attackCity()` рассчитывает `AttackCitySuccess` до анимации, но React применяет рассчитанный state после визуального подхода к цели. Таким образом SVG не может изменить winner/casualties/retreat и не входит в simulation layer.


## 20. Fog of war and map knowledge (Stage 20)

`core/map/MapVisibility.ts` является единственным правилом стратегической видимости. Он различает `unknown`, `explored` и `visible`. Текущее наблюдение выводится из положения армий игрока и контролируемых городов; историческое знание хранится в `CampaignState.discoveredNodeIds`.

`map_revealed` остаётся обычным faction trait. Поэтому Илиеш не проверяется по `leaderId`: `factionKnowsFullMap()` заставляет visibility layer вернуть `visible` для всех узлов и при создании/миграции кампании записывает всю карту в map knowledge.

Renderer не имеет права использовать скрытые данные для принятия решений. `SvgWorldMap`, `CitiesOverview`, `DecisionPanel` и `RaceIndicator` получают/вычисляют visibility и не показывают актуального владельца, гарнизон, rival army position или точную rival army strength за пределами текущего наблюдения. Разведанный ранее узел сохраняет статические название/тип/описание, но динамические сведения считаются устаревшими.

Fog knowledge меняет сериализуемый GameState, поэтому Stage 20 поднимает save format до v11. v10→v11 начинает со стартовой области текущей армии; для `map_revealed` миграция сразу открывает все 21 узел.


## 21. Specimen research and faction traits (Stage 21)

`core/research/completeResearch.ts` — единственная команда покупки исследований. `data/research/prototypeResearch.ts` содержит декларативные definition: стоимость в образцах, prerequisites и массив обычных `FactionTrait`. Исследование не тратит strategic action; оно изменяет один сериализуемый `GameState` и добавляет permanent traits игроку.

Новые эффекты не должны ветвиться по research id. Supply costs, map vision, upkeep, city income, battle morale и Root requirements читают агрегированные faction traits через `core/leaders/LeaderAbility.ts`.

Внутренние группы Орсии также используют тот же trait contract. Нацболы получают `initial_garrison_morale_floor` и `defeat_reaction`; Тираниды — `incoming_casualty_multiplier_by_enemy_tactic`. `attackCity()` передаёт универсальные casualty/morale multipliers в `simulateBattle()`, поэтому BattleSimulator не знает конкретных faction ids.

`campaign.pendingFactionEvent` — сериализуемый simulation state. Modal Лимоненко является presentation layer: кнопка вызывает `resolveFactionDefeatEvent()`, а уже core переводит оставшиеся города, удаляет армии/фракцию и помечает событие разрешённым.

Battle tactics теперь имеют два casualty-risk anchors: parity и strong superiority. `simulateBattle()` интерполирует между ними по отношению текущей round power сторон. Это позволяет Натиску быть рискованным при паритете, но экономным при явном превосходстве; Осторожности — наоборот. Prolonged morale penalty Натиска также принадлежит BattleRules и применяется только если бой дожил до заданного раунда.

Recruitment rest реализован в общей `recruitAtCity()` через `moraleRestore/moraleCap`. Команда меняет morale и деньги/roster, но намеренно не меняет supplies.


## 22. Remaining Orsia traits and city action UI (Stage 22)

Оставшиеся группы Орсии используют тот же `FactionTrait` contract, без прямых проверок faction id в BattleSimulator. Орки получают `random_battle_morale_gain`; все проверки шанса и величины подъёма используют battle RNG stream. Гоблины получают `initial_garrison_size_multiplier_range` при seeded создании кампании и `battle_unit_power_multiplier`, который масштабирует их attack/defense contribution и final-strength resolution. ФГУшники получают `captured_city_income_multiplier`: при захвате их города core записывает permanent penalty в `CityState.incomeMultiplier`, а `collectCityIncome()` читает его вместе с обычными faction-wide income modifiers.

`CityState.incomeMultiplier` принадлежит конкретному городу и не вычисляется UI. Штраф не умножается повторно при последующих перезахватах: capture orchestration сохраняет минимальный уже накопленный multiplier. v12→v13 выставляет старым городам `1` и добавляет активным орсийским фракциям отсутствующие Stage 22 traits. Исторического бывшего владельца старого v12 save восстановить нельзя, поэтому уже захваченные до миграции города получают нейтральный multiplier `1`; новые захваты после миграции работают по v13 правилам.

`DecisionPanel` теперь read-only location information: описание, владелец, гарнизон, налог, supply context и trait summary. Командные кнопки вынесены в `StrategicActionBar`. Отдых и найм вычисляются от фактического `playerNodeId`, поэтому доступны в текущем контролируемом городе без необходимости сначала выбирать его на карте. Движение/штурм/финальная операция зависят от выбранной цели, а `Завершить ход` остаётся отдельным persistent campaign control. UI только вызывает core commands и не меняет GameState самостоятельно.

## 23. Map content synchronization, city artifacts and surface briefings (Stage 23)

Актуальная таблица карты снова является содержательным source of truth для 21 узла. Стабильные internal node ids не переименовываются ради save compatibility: например `quiet-scream` теперь отображается как «Убежище 103», `temporary-outpost` — как «Неестественные джунгли», `rival-post` — как «Канцелярские Копи». Имена/описания остаются presentation data, а topology графа не меняется.

Шесть POI-событий остаются data-driven в `data/events/prototypeEvents.ts`. Их актуальные находки используют новые canonical artifact ids. v13→v14 мигрирует старые artifact ids (`warehouse-one-seal`, `temporary-key` и т. п.) и legacy event `temporary-pass` в новые Stage 23 ids, не переигрывая уже применённые численные эффекты.

Городской артефакт оформлен отдельной core-командой `resolveCityVisitArtifact()`. UI вызывает её только после фактически завершённого перехода или успешного захвата. Команда проверяет реальную позицию армии, один раз записывает city id в `campaign.cityArtifactClaimedIds` и применяет artifact effects через общий `acquireArtifact()`. Поэтому повторный вход в город не фармит артефакты, а Владос получает тот же ×1,5 multiplier, что и для POI-находок. Текущая таблица `cityVisitArtifactByCityId` — временное фиксированное распределение, однажды перемешанное при разработке; runtime RNG для него не используется.

Сюжетные сообщения с поверхности реализованы через `core/story/SurfaceBriefing.ts` + `data/story/prototypeSurfaceBriefings.ts`. `CampaignState` хранит только pending/resolved ids; React-overlay является чистой presentation. Первые пять сообщений идут строго последовательно: первое требует минимум один артефакт, следующие привязаны к росту числа контролируемых городов и разрешению `almost-root-shop`. Финальное сообщение `surface-root-priority` является manual-only и ставится в pending state при попытке открыть финальную операцию; только после подтверждения UI открывает обычный `RootFinaleOverlay`.

«Убежище 103» использует существующую recruitment system без special-case UI: городская definition предлагает `student-103`, а сам юнит является обычным ranged UnitDefinition с усиленными характеристиками относительно базовых следопытов.


## 25. Strategic city properties and faction ownership map (Stage 25)

`CityDefinition.special` хранит декларативное название, описание и массив `CityTrait`. Simulation не ветвится по city id: `core/cities/cityTraits.ts` агрегирует локальные множители для налогов, отдыха, найма, faction-wide upkeep, defender power и финальной стоимости Root operation.

Все consumers используют effective values из core. `collectCityIncome()` комбинирует локальное свойство с persistent `CityState.incomeMultiplier`, поэтому коррупция ФГУшников и уникальность конкретного города не конфликтуют. `restAtCity()`, recruitment UI/core, `payArmyUpkeep()`, `attackCity()` и `rootObjective.ts` читают соответствующие resolver'ы. AI target evaluation также использует effective tax/defense/recruitment, поэтому городские свойства не являются player-only бонусами.

Карта владельцев остаётся presentation layer. `SvgWorldMap` получает уже известные identity assets и рисует портрет владельца внутри видимого city node: player leader, rival leader или leader конкретной Orsia group. Owner identity по-прежнему проходит через `MapVisibility`; для `explored`, но не `visible` города renderer не должен раскрывать актуального владельца портретом.

Faction palette является CSS/presentation metadata: игрок — зелёный, rival — синий, группы Орсии — различные оттенки красного/оранжевого/розового. Это не меняет `superFactionId = orsia` и не превращает внутренние группы в воюющие государства.

Stage 25 не добавляет сериализуемых полей. Save format остаётся v14; migration не требуется.


## Stage 26 — artifact loadout и scientific readiness

Артефактная коллекция (`campaign.artifactIds`) отделена от активного комплекта (`campaign.activeArtifactIds`). Одновременно работают максимум три предмета. Эффекты активного предмета материализуются как обычные `FactionTrait` с `source: artifact:<id>`, поэтому battle/economy/supply resolvers не знают artifact ids. Смена комплекта разрешена только в контролируемом городе и не является стратегическим действием.

Образцы имеют два состояния: расходуемый `resources.specimens` и монотонный `FactionState.specimensCollected`. Root access использует второй показатель; исследования расходуют первый. Так исследование не конфликтует с требованием накопить научные данные для финала.

Netlify/Vite compile contract теперь явно включает `vite/client`, Node type declarations и Node 22.12.0.
