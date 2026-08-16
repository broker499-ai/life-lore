import type { SurfaceBriefingDefinition } from '@/core/story/SurfaceBriefing';

export const ROOT_PRIORITY_BRIEFING_ID = 'surface-root-priority';

export const prototypeSurfaceBriefings: readonly SurfaceBriefingDefinition[] = [
  {
    id: 'surface-artifact-directive',
    eyebrow: 'Сообщение с поверхности',
    paragraphs: [
      'Предварительные данные подтверждают: экосистема Орсии принципиально отличается от поверхностной.',
      'Собирайте **артефакты**. Даже если не понимаете, зачем они нужны.',
    ],
    acknowledgeLabel: 'узнали согласны',
    condition: { minArtifactCount: 1 },
  },
  {
    id: 'surface-baked-lifeforms',
    eyebrow: 'Сообщение с поверхности',
    title: 'Научный отдел сообщает:',
    paragraphs: [
      'Полученные материалы представляют значительный интерес.',
      'Особое внимание просим уделять формам жизни с выраженным запёком.',
    ],
    acknowledgeLabel: 'Выраженным чем?',
    condition: { minControlledCities: 2 },
  },
  {
    id: 'surface-temperature-classification',
    eyebrow: 'Сообщение с поверхности',
    paragraphs: [
      'Для классификации образцов теперь требуется указывать, сохраняют ли они форму при температуре 180–200 градусов.',
    ],
    acknowledgeLabel: 'Ясно...',
    condition: { minControlledCities: 3 },
  },
  {
    id: 'surface-fauna-bones',
    eyebrow: 'Сообщение с поверхности',
    paragraphs: [
      'При обнаружении местной живности не ограничивайтесь фотографиями. Считайте кости и пробуйте костный мозг.',
    ],
    acknowledgeLabel: 'Ага',
    condition: { minControlledCities: 4 },
  },
  {
    id: 'surface-sensory-profile',
    eyebrow: 'Сообщение с поверхности',
    paragraphs: [
      'В предыдущем отчёте термин «послевкусие» следует читать как «остаточный сенсорный профиль». Просим не придавать значения данной корректировке.',
    ],
    acknowledgeLabel: 'Теперь придаю',
    condition: { requiredResolvedEventId: 'almost-root-shop' },
  },
  {
    id: ROOT_PRIORITY_BRIEFING_ID,
    eyebrow: 'Срочное сообщение с поверхности',
    paragraphs: [
      'Корень остаётся абсолютным приоритетом. Однако все свободные силы требуется направить на сбор грибов и светящихся ягод, они заканчиваются.',
    ],
    acknowledgeLabel: 'Да что там происходит наверху?',
    condition: { manualOnly: true },
  },
];

export const prototypeSurfaceBriefingById = Object.fromEntries(
  prototypeSurfaceBriefings.map((briefing) => [briefing.id, briefing]),
) as Record<string, SurfaceBriefingDefinition>;
