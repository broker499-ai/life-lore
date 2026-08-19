# Stage 34 — variant pre-root maps, Lateki, leader perk swap

Version: **0.34.0**  
Save format: **v19**

## Campaign variation

The first half of Orsia is no longer one fixed graph. New campaigns deterministically choose one of three layouts from the campaign seed:

- `braided` — Переплетение;
- `terraces` — Террасы;
- `broken-ring` — Разорванное кольцо.

The two expedition starts and the thematic final approach (`Место, где почти нашли Корень` → `Корневой Предел` → `Корень Живознания?`) stay fixed. The other 16 existing first-half city/POI identities are shuffled into layout slots with seeded RNG. Their events, city traits, owners and artifact rules follow the location identity, not the slot.

The shortest route from either expedition start to the false Root is now at least 8 edges (legacy map: player 7, rival 6). The post-false-root extension remains the existing single linear layout with its own seeded order.

v18 saves migrate to the exact legacy/classic first-half map so an in-progress campaign is not rearranged underneath the player.

## Lateki

`orsia-fgushniki` is replaced by `orsia-lateki`.

- Name: **Латеки**
- Leader: **Федеральный Совет**
- Portrait: `public/assets/factions/orsia/lateki.webp`
- Existing economic niche is preserved: captured Lateki cities retain the ×0.60 income trace.

v18 migration renames the old faction id in factions, city ownership, capitals, pending faction-event references and any armies.

## Expedition leader perks

### Артемиос — «Артем есть Артем»

- new trait: `ignore_morale`;
- expedition morale is always 100;
- battle sectors are morale-locked at 100 while they still contain troops;
- morale event penalties and supply pressure cannot lower it;
- old saves normalize Artemios armies to 100 immediately.

### Максон — «Наземный флот»

- now uses the existing `ignore_supply` trait;
- movement, assaults and the final operation have zero supply cost;
- supply route pressure is ignored.

The old Makson morale-damage bonus is removed.
