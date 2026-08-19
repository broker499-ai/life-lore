# Stage 32 — visible battle scenes, richer animation, skip battle, developer mode

## Battle presentation
- Battle backgrounds are now applied directly as the battle-pitch background layer, with only a light contrast veil.
- Unit markers are rendered as animated tactical glyphs instead of static circles.
- Line units visibly lunge during clashes; all active units have a subtle motion cycle.
- Ranged units fire moving projectiles along their volley arcs.
- Casualties produce a brighter impact flash/spark marker.
- Existing sector pressure, flank, reserve and command presentation remains intact.

## Skip battle
- `⏭ Пропустить бой` is always available while a battle is unresolved.
- It skips the remaining playback and suppresses any remaining mid-battle command prompts.
- If the player already issued a command, that command remains part of the result; only later interventions are skipped.

## Developer mode
- Toggle from the campaign menu: `Режим разработчика: ВКЛ/ВЫКЛ`.
- When enabled, the player does not spend the one-strategic-action-per-turn allowance on movement, attacks, recruitment, rest or the final Root operation.
- Costs, adjacency, ownership and other normal rules still apply. AI factions do not receive this benefit.
- Developer mode is saved in the campaign state.

## Save compatibility
- Save format: v18.
- v17 -> v18 migration initializes developer mode to `false`.
