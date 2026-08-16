import { getArmyTotalUnits } from '@/core/armies/armyStats';
import { getCentralNodeId, getShortestPathDistance, type MapGraph } from '@/core/map/MapGraph';
import type { GameState } from '@/core/state/GameState';

export function RaceIndicator({
  state,
  graph,
  rivalFactionId,
  rivalArmyId,
}: {
  state: GameState;
  graph: MapGraph;
  rivalFactionId: string;
  rivalArmyId: string;
}) {
  const centerId = getCentralNodeId(graph);
  const playerArmy = state.armies['player-main'];
  const rivalArmy = state.armies[rivalArmyId];
  const playerDistance = centerId && playerArmy ? getShortestPathDistance(graph, playerArmy.nodeId, centerId) : null;
  const rivalDistance = centerId && rivalArmy ? getShortestPathDistance(graph, rivalArmy.nodeId, centerId) : null;
  const playerCities = countCities(state, state.playerFactionId);
  const rivalCities = countCities(state, rivalFactionId);

  return (
    <div className="race-indicator" aria-label="Гонка за центром">
      <RaceSide
        name="Экспедиция"
        cities={playerCities}
        distance={playerDistance}
        units={playerArmy ? getArmyTotalUnits(playerArmy) : 0}
        kind="player"
      />
      <span className="race-divider">к Корню</span>
      <RaceSide
        name="Компания «Меридиан»"
        cities={rivalCities}
        distance={rivalDistance}
        units={rivalArmy ? getArmyTotalUnits(rivalArmy) : 0}
        kind="rival"
      />
    </div>
  );
}

function RaceSide({
  name,
  cities,
  distance,
  units,
  kind,
}: {
  name: string;
  cities: number;
  distance: number | null;
  units: number;
  kind: 'player' | 'rival';
}) {
  return (
    <div className={`race-side is-${kind}`}>
      <strong>{name}</strong>
      <span>{cities} г. · {units} бойц.</span>
      <span>{distance === null ? 'путь неизвестен' : `${distance} шаг. до центра`}</span>
    </div>
  );
}

function countCities(state: GameState, factionId: string): number {
  return Object.values(state.cities).filter((city) => city.ownerFactionId === factionId).length;
}
