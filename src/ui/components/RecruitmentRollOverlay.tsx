import { createPortal } from 'react-dom';

export type RecruitmentRollOutcome = 'success' | 'fail';

export function RecruitmentRollOverlay({ outcome }: { outcome: RecruitmentRollOutcome }) {
  if (typeof document === 'undefined') return null;
  const isFail = outcome === 'fail';
  return createPortal(
    <div
      className={`recruit-roll-overlay is-${outcome}`}
      role="status"
      aria-live="assertive"
      aria-label={isFail ? 'Рискованный набор провален' : 'Рискованный набор успешен'}
    >
      <div className="recruit-roll-flash" aria-hidden="true" />
      <img
        src={isFail ? '/assets/recruitment/d20-fail.webp' : '/assets/recruitment/d20-success.webp'}
        alt={isFail ? 'Кубик: провал' : 'Кубик: успех'}
        draggable={false}
      />
    </div>,
    document.body,
  );
}
