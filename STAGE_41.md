# Stage 41 — Continuous battle, direct flanking, recruitment UX and DEV expansion

## Recruitment
- Recruitment is now shown in an upward mobile sheet so the confirmation action cannot be clipped by the fixed command deck.
- The confirmation button is sticky and explicitly labelled `Подтвердить найм`.
- Normal safe recruitment is ~60% larger than the city's old base offer and risky capacity is substantially larger.
- DEV recruitment is free, guaranteed and supports up to 250 infantry in one action.

## Continuous battle presentation
- After first contact, round-start, command and morale frames no longer reset formations to their home positions.
- Troops remain at the front line with continuous give-and-take motion and short animated retreats.
- Melee vectors remain active through morale exchanges instead of disappearing between clashes.

## Direct cross-lane flanking
- During a live command opportunity tap one of your active sector cards, then tap an adjacent enemy sector.
- Supported maneuvers: left→center, center→left, center→right, right→center.
- The source formation visibly curves into the target lane; an animated path shows the maneuver.
- Simulation redirects most of the source lane's attack into the target with a modest flanking bonus, while exposing the source lane defensively.

## Blood / impact
- The existing lane blood remains.
- At least the guaranteed casualty beat also produces a conspicuous full-screen splash; large casualty frames can add more.
- Latек/Tyranid victim splashes are pink, other blood is red.
- Full-screen impacts briefly shake the battle view.

## Developer mode
- All current and deep-route map nodes are present and fully visible immediately.
- Strategic actions remain unlimited.
- Money costs are ignored for player recruitment, upkeep and negative-money event choices; the header displays `∞` money.
- Recruitment ignores riot locks and is free/guaranteed with a large DEV slider range.

Save format remains v22: no persistent schema was added.
