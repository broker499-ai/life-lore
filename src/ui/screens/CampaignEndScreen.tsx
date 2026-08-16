import { getArmyTotalUnits } from '@/core/armies/armyStats';
import type { GameState } from '@/core/state/GameState';
import { RIVAL_FACTION_ID, rivalExpeditionById } from '@/data/factions/rivalExpeditions';
import { prototypeLeaderById } from '@/data/leaders/prototypeLeader';

export function CampaignEndScreen({ state, onExit }: { state: GameState; onExit: () => void }) {
  const won = state.campaign.status === 'victory';
  const playerLeader = prototypeLeaderById[state.selectedLeaderId];
  const rivalLeader = prototypeLeaderById[state.campaign.rivalLeaderId];
  const rival = rivalExpeditionById[state.campaign.rivalOrganizationId];
  const playerFaction = state.factions[state.playerFactionId];
  const playerArmy = state.armies['player-main'];
  const playerCities = Object.values(state.cities).filter((city) => city.ownerFactionId === state.playerFactionId).length;
  const rivalCities = Object.values(state.cities).filter((city) => city.ownerFactionId === RIVAL_FACTION_ID).length;

  return (
    <main className={`screen campaign-end-screen ${won ? 'is-victory' : 'is-defeat'}`}>
      <section className="campaign-end-card">
        <span className="eyebrow">Экспедиционный итог · ход {state.campaign.endedTurn ?? state.turn}</span>
        <h1>{won ? 'Корень Живознания получен' : 'Экспедиция завершена'}</h1>
        <p className="campaign-end-lead">{getEndingText(state)}</p>

        <div className="campaign-end-rivals">
          <div>
            <span>Экспедиция</span>
            <strong>{playerLeader?.name ?? state.selectedLeaderId}</strong>
          </div>
          <div>
            <span>{rival?.name ?? 'Конкуренты'}</span>
            <strong>{rivalLeader?.name ?? state.campaign.rivalLeaderId}</strong>
          </div>
        </div>

        <div className="campaign-end-stats" aria-label="Итоги кампании">
          <Stat label="Ходов" value={state.campaign.endedTurn ?? state.turn} />
          <Stat label="Ваших городов" value={playerCities} />
          <Stat label="Городов конкурента" value={rivalCities} />
          <Stat label="Армия" value={playerArmy ? getArmyTotalUnits(playerArmy) : 0} />
          <Stat label="Образцы" value={playerFaction?.resources.specimens ?? 0} />
          <Stat label="Артефакты" value={state.campaign.artifactIds.length} />
        </div>

        <button type="button" className="primary-button campaign-end-exit" onClick={onExit}>
          В главное меню
        </button>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="campaign-end-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getEndingText(state: GameState): string {
  if (state.campaign.endingReason === 'root_claimed') {
    return 'Экспедиция первой дошла до центрального святилища Орсии и изъяла Корень. На поверхности уже требуют приложить образец к отчёту в трёх экземплярах.';
  }
  if (state.campaign.endingReason === 'rival_root_claimed') {
    const rival = rivalExpeditionById[state.campaign.rivalOrganizationId]?.name ?? 'конкурирующая экспедиция';
    return `${rival} добрался до Корня раньше. Центр Орсии закрыт их полевым актом приёма-передачи, а ваша экспедиция официально опоздала.`;
  }
  return 'Основная армия перестала быть боеспособной. Без неё экспедиция больше не может продолжать борьбу за центр Орсии.';
}
