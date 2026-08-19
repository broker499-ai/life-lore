import { getArmyTotalUnits } from '@/core/armies/armyStats';
import { factionKnowsFullMap } from '@/core/leaders/LeaderAbility';
import { getCentralNodeId, getShortestPathDistance, type MapGraph } from '@/core/map/MapGraph';
import { getMapNodeVisibilityById } from '@/core/map/MapVisibility';
import type { GameState } from '@/core/state/GameState';
import { rivalExpeditionById } from '@/data/factions/rivalExpeditions';

export function RaceIndicator({
  state,
  graph,
  rivalArmyId,
}: {
  state: GameState;
  graph: MapGraph;
  rivalArmyId: string;
}) {
  const centerId = getCentralNodeId(graph);
  const playerArmy = state.armies['player-main'];
  const rivalArmy = state.armies[rivalArmyId];
  const playerDistance = centerId && playerArmy ? getShortestPathDistance(graph, playerArmy.nodeId, centerId) : null;
  const rivalDistance = centerId && rivalArmy ? getShortestPathDistance(graph, rivalArmy.nodeId, centerId) : null;
  const rivalName = rivalExpeditionById[state.campaign.rivalOrganizationId]?.shortName
    ?? rivalExpeditionById[state.campaign.rivalOrganizationId]?.name
    ?? 'Конкуренты';
  const visibility = getMapNodeVisibilityById(state, graph, state.playerFactionId);
  const fullMapKnown = factionKnowsFullMap(state, state.playerFactionId);
  const rivalArmyVisible = Boolean(rivalArmy && visibility[rivalArmy.nodeId] === 'visible');

  return (
    <div className="race-indicator" aria-label="Гонка за Корнем">
      <div className="race-compact-row is-player">
        <strong>ВЫ</strong>
        <span>{formatDistance(playerDistance)}</span>
        <small>{playerArmy ? getArmyTotalUnits(playerArmy) : 0} бойц.</small>
      </div>
      <div className="race-compact-row is-rival">
        <strong>{rivalName}</strong>
        {fullMapKnown || rivalArmyVisible ? (
          <>
            <span>{formatDistance(rivalDistance)}</span>
            <small>{rivalArmy ? getArmyTotalUnits(rivalArmy) : 0} бойц.</small>
          </>
        ) : (
          <span className="is-hidden-intel">вне наблюдения</span>
        )}
      </div>
      <span className="race-target-label">К КОРНЮ</span>
    </div>
  );
}

function formatDistance(distance: number | null): string {
  return distance === null ? '? шаг.' : `${distance} шаг.`;
}
