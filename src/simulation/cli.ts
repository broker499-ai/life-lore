import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  getDefaultSimulationMatrix,
  getLeaderName,
  simulateCampaign,
  simulationStrategies,
  type CampaignSimulationResult,
  type SimulationStrategy,
} from '@/simulation/simulateCampaign';
import { prototypeLeaderById } from '@/data/leaders/prototypeLeader';

const args = parseArgs(process.argv.slice(2));
const runs = positiveInt(args.runs, 250);
const maxTurns = positiveInt(args.maxTurns, 90);
const seedStart = positiveInt(args.seed, 1);
const verbose = args.verbose === true;
const requestedLeader = typeof args.leader === 'string' ? args.leader : null;
const requestedStrategy = typeof args.strategy === 'string' ? args.strategy as SimulationStrategy : null;

if (requestedLeader && !prototypeLeaderById[requestedLeader]) fail(`Неизвестный лидер: ${requestedLeader}`);
if (requestedStrategy && !simulationStrategies.includes(requestedStrategy)) fail(`Неизвестная стратегия: ${requestedStrategy}`);

const matrix = getDefaultSimulationMatrix().filter((item) =>
  (!requestedLeader || item.leaderId === requestedLeader) &&
  (!requestedStrategy || item.strategy === requestedStrategy),
);
if (matrix.length === 0) fail('Не осталось комбинаций для симуляции.');

console.log(`Корень Живознания · headless balance simulation`);
console.log(`Прогоны: ${runs} · максимум ${maxTurns} ходов · seed ${seedStart}…${seedStart + runs - 1}`);
if (requestedLeader) console.log(`Лидер: ${getLeaderName(requestedLeader)}`);
if (requestedStrategy) console.log(`Стратегия: ${requestedStrategy}`);
console.log('');

const results: CampaignSimulationResult[] = [];
for (let index = 0; index < runs; index += 1) {
  const combo = matrix[index % matrix.length];
  const seed = seedStart + index;
  const result = simulateCampaign({ seed, leaderId: combo.leaderId, strategy: combo.strategy, maxTurns, verbose });
  results.push(result);
  if (!verbose && (index + 1) % Math.max(25, Math.floor(runs / 10)) === 0) {
    process.stdout.write(`  ${index + 1}/${runs}\n`);
  }
}

const outputDir = resolve(process.cwd(), 'simulation-results');
await mkdir(outputDir, { recursive: true });
const timestamp = new Date().toISOString();
const summary = buildSummary(results, timestamp);
await writeFile(resolve(outputDir, 'latest-summary.md'), summary, 'utf8');
await writeFile(resolve(outputDir, 'latest-runs.json'), JSON.stringify({ generatedAt: timestamp, results }, null, 2), 'utf8');
await writeFile(resolve(outputDir, 'latest-runs.csv'), toCsv(results), 'utf8');

console.log('');
console.log(summary.replace(/^# .*\n+/m, '').replace(/\n##/g, '\n').trim());
console.log('');
console.log('Готово: simulation-results/latest-summary.md');
console.log('        simulation-results/latest-runs.csv');
console.log('        simulation-results/latest-runs.json');

function buildSummary(results: CampaignSimulationResult[], generatedAt: string): string {
  const wins = results.filter((r) => r.status === 'victory').length;
  const defeats = results.filter((r) => r.status === 'defeat').length;
  const timeouts = results.filter((r) => r.status === 'timeout').length;
  const falseRoot = results.map((r) => r.falseRootTurn).filter((v): v is number => v !== null);
  const rows: string[] = [];
  rows.push('# Campaign simulation summary');
  rows.push('');
  rows.push(`Generated: ${generatedAt}`);
  rows.push('');
  rows.push(`Runs: **${results.length}**`);
  rows.push(`Player wins: **${pct(wins, results.length)}** (${wins})`);
  rows.push(`Rival wins/defeats: **${pct(defeats, results.length)}** (${defeats})`);
  rows.push(`Timeouts: **${pct(timeouts, results.length)}** (${timeouts})`);
  rows.push(`Median duration: **${median(results.map((r) => r.turns))} turns**`);
  rows.push(`Median false root: **${falseRoot.length ? median(falseRoot) : '—'} turns**`);
  rows.push(`Average player cities: **${avg(results.map((r) => r.playerCities)).toFixed(1)}**`);
  rows.push(`Average player battles: **${avg(results.map((r) => r.playerBattles)).toFixed(1)}**`);
  rows.push(`Average stuck turns: **${avg(results.map((r) => r.stuckTurns)).toFixed(1)}**`);
  rows.push('');
  rows.push('## Leaders');
  rows.push('');
  rows.push('| Leader | Runs | Win rate | Median turns | Timeout |');
  rows.push('|---|---:|---:|---:|---:|');
  for (const leaderId of [...new Set(results.map((r) => r.leaderId))]) {
    const group = results.filter((r) => r.leaderId === leaderId);
    rows.push(`| ${getLeaderName(leaderId)} | ${group.length} | ${pct(group.filter((r) => r.status === 'victory').length, group.length)} | ${median(group.map((r) => r.turns))} | ${pct(group.filter((r) => r.status === 'timeout').length, group.length)} |`);
  }
  rows.push('');
  rows.push('## Strategies');
  rows.push('');
  rows.push('| Strategy | Runs | Win rate | Median turns | False root |');
  rows.push('|---|---:|---:|---:|---:|');
  for (const strategy of [...new Set(results.map((r) => r.strategy))]) {
    const group = results.filter((r) => r.strategy === strategy);
    const roots = group.map((r) => r.falseRootTurn).filter((v): v is number => v !== null);
    rows.push(`| ${strategy} | ${group.length} | ${pct(group.filter((r) => r.status === 'victory').length, group.length)} | ${median(group.map((r) => r.turns))} | ${roots.length ? median(roots) : '—'} |`);
  }
  rows.push('');
  rows.push('## Basic diagnostics');
  rows.push('');
  const zeroWins = [...new Set(results.map((r) => r.leaderId))].filter((id) => results.filter((r) => r.leaderId === id).every((r) => r.status !== 'victory'));
  if (zeroWins.length) rows.push(`- Leaders with zero simulated wins: ${zeroWins.map(getLeaderName).join(', ')}.`);
  if (timeouts / results.length > 0.1) rows.push(`- ⚠ Timeout rate exceeds 10% (${pct(timeouts, results.length)}). This usually means the bot or campaign can get strategically stuck.`);
  if (avg(results.map((r) => r.stuckTurns)) > 5) rows.push('- ⚠ Average stuck-turn count exceeds 5. Inspect verbose replay of timeout seeds.');
  if (!zeroWins.length && timeouts / results.length <= 0.1 && avg(results.map((r) => r.stuckTurns)) <= 5) rows.push('- No immediate structural red flag detected by the coarse diagnostics.');
  rows.push('');
  rows.push('Replay any suspicious run with:');
  rows.push('```bash');
  rows.push('npm run simulate -- --runs 1 --seed <SEED> --leader <ID> --strategy <STRATEGY> --verbose');
  rows.push('```');
  return rows.join('\n');
}

function toCsv(results: CampaignSimulationResult[]): string {
  const simpleKeys: Array<keyof CampaignSimulationResult> = [
    'seed','leaderId','strategy','status','endingReason','turns','falseRootTurn','extensionUnlockedTurn',
    'playerCities','rivalCities','playerMoney','playerSupplies','knowledgeAvailable','knowledge',
    'playerUnits','maxPlayerUnits','playerBattles','playerBattleWins','playerBattleLosses','playerCasualties',
    'rivalActions','artifactsFound','activeArtifacts','legacyResearchCompleted','poiResolved','extensionOrder',
    'activeOrsiaFactions','rivalLeaderId','rivalOrganizationId','stuckTurns',
  ];
  const header = [...simpleKeys, 'actionCounts', 'tacticCounts'];
  const lines = [header.join(',')];
  for (const row of results) {
    const values = simpleKeys.map((key) => csvCell(row[key]));
    values.push(csvCell(JSON.stringify(row.actionCounts)), csvCell(JSON.stringify(row.tacticCounts)));
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function parseArgs(tokens: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = tokens[i + 1];
    if (!next || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i += 1; }
  }
  return out;
}

function positiveInt(value: string | boolean | undefined, fallback: number): number {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function pct(part: number, total: number): string {
  return total <= 0 ? '0.0%' : `${((part / total) * 100).toFixed(1)}%`;
}

function avg(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(values: number[]): number | string {
  if (!values.length) return '—';
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
