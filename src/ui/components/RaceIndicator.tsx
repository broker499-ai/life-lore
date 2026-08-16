import { getArmyTotalUnits } from '@/core/armies/armyStats';
import { factionKnowsFullMap } from '@/core/leaders/LeaderAbility';
import { getCentralNodeId, getShortestPathDistance, type MapGraph } from '@/core/map/MapGraph';
import { getMapNodeVisibilityById } from '@/core/map/MapVisibility';
import type { GameState } from '@/core/state/GameState';
import { rivalExpeditionById } from '@/data/factions/rivalExpeditions';
import { prototypeLeaderById } from '@/data/leaders/prototypeLeader';

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
  const rivalName = rivalExpeditionById[state.campaign.rivalOrganizationId]?.name ?? 'Конкуренты';
  const playerLeaderName = prototypeLeaderById[state.selectedLeaderId]?.name ?? state.selectedLeaderId;
  const rivalLeaderName = prototypeLeaderById[state.campaign.rivalLeaderId]?.name ?? state.campaign.rivalLeaderId;
  const visibility = getMapNodeVisibilityById(state, graph, state.playerFactionId);
  const fullMapKnown = factionKnowsFullMap(state, state.playerFactionId);
  const rivalArmyVisible = Boolean(rivalArmy && visibility[rivalArmy.nodeId] === 'visible');
  const knownRivalCities = graph.nodes.filter(
    (node) => visibility[node.id] === 'visible' && state.cities[node.id]?.ownerFactionId === rivalFactionId,
  ).length;

  return (
    <div className="race-indicator" aria-label="Гонка за центром">
      <RaceSide
        name="Экспедиция"
        leaderName={playerLeaderName}
        cities={playerCities}
        distance={playerDistance}
        units={playerArmy ? getArmyTotalUnits(playerArmy) : 0}
        kind="player"
      />
      <span className="race-divider">к Корню</span>
      <RaceSide
        name={rivalName}
        leaderName={rivalLeaderName}
        cities={fullMapKnown ? rivalCities : knownRivalCities}
        distance={fullMapKnown || rivalArmyVisible ? rivalDistance : null}
        units={fullMapKnown || rivalArmyVisible ? (rivalArmy ? getArmyTotalUnits(rivalArmy) : 0) : null}
        kind="rival"
        limitedIntel={!fullMapKnown}
        armyVisible={rivalArmyVisible}
      />
    </div>
  );
}

function RaceSide({
  name,
  leaderName,
  cities,
  distance,
  units,
  kind,
  limitedIntel = false,
  armyVisible = true,
}: {
  name: string;
  leaderName: string;
  cities: number;
  distance: number | null;
  units: number | null;
  kind: 'player' | 'rival';
  limitedIntel?: boolean;
  armyVisible?: boolean;
}) {
  return (
    <div className={`race-side is-${kind}`}>
      <strong>{name}</strong>
      <span>Лидер: {leaderName}</span>
      {limitedIntel ? (
        <>
          <span>Замечено городов: {cities}</span>
          <span>{armyVisible && units !== null
            ? `${units} бойц. · ${distance === null ? 'путь неизвестен' : `${distance} шаг. до центра`}`
            : 'Армия вне наблюдения'}</span>
        </>
      ) : (
        <>
          <span>{cities} г. · {units ?? 0} бойц.</span>
          <span>{distance === null ? 'путь неизвестен' : `${distance} шаг. до центра`}</span>
        </>
      )}
    </div>
  );
}

function countCities(state: GameState, factionId: string): number {
  return Object.values(state.cities).filter((city) => city.ownerFactionId === factionId).length;
}
