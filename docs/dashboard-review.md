# Dashboard feature design review

Reviewed 9 September 2026. This review covers Analytics/Revenue, Financial, Artists, Clients, Import, and Settings. `/dashboard/analytics` re-exports the Revenue page, so the Analytics and Revenue routes share their implementation. The broader route/component inventory is in [design-inventory.md](design-inventory.md).

The existing theme variables and layouts remain the starting point. Shared semantic colours and native modal behaviour are adopted where the review found concrete defects; this is not a claim that every legacy inline style has been migrated.

## Changes by feature

| Feature | Findings and changes |
| --- | --- |
| Analytics / Revenue | Date fields now have accessible names. Quick ranges expose their selected state and expanded names, and wrap when space is limited. Loading and failures are announced. The top-clients table is named and its header cells declare their column scope. |
| Financial | Date ranges and content selection expose their names/state. The password field identifies itself, supports password managers, and links its error. Artist payout history and earnings actions are native buttons, including rows without a payable balance. Payout and earnings overlays use the shared `Dialog`, with initial focus, background isolation, dismissal and focus restoration. Payout fields have accessible names, amount modes expose selection, and status badges use theme-aware success/warning tokens. The earnings table scrolls inside its dialog. |
| Artists | Artist names provide a keyboard-accessible route into their details without nesting the approve/reject actions inside a button. Pending/past filters expose their state. Schedule time fields name their day and purpose. Accepting bookings is exposed as a named switch. Onboarding, rejection, and last-day flows use the shared `Dialog`. Details and statistics wrap on smaller viewports. Approval/rejection controls use semantic colour tokens; last-day actions use the correct foreground in both themes and reject empty or past date selections. |
| Clients | Search has an accessible name. Client rows can be opened with Enter or Space and expose expansion state. The detail panel and close action are named. Preferences and allergy options expose selection; allergy details, pain tolerance and note fields have names. Pain tolerance distinguishes an unrecorded value from a recorded score. Loading/failures announce their state. Pagination wraps; the detail panel uses the shared responsive overlay rule on narrow viewports. |
| Import | The CSV drop zone is keyboard-operable. Source/mapping/artist controls have names; segmented selections expose their state. Preview table headers declare column scope. Mapping rows wrap. Progress now retains the total while importing: previously the preview-only row calculation became empty when the step changed and the progress UI displayed `0 / 0`. The progress bar supplies a name and numeric values, with announced progress text. Import payloads and chunking are unchanged. |
| Settings | Content and language selections expose state. Studio name, timezone, account email, weekly hours, colour controls and consent editor fields/actions have accessible names. Reminder and widget-field toggles are named switches; the theme control announces its state. Settings, widget and consent grids use the shared narrow-viewport rule. Consent editing, station last day and subscription cancellation use `Dialog`; saving prevents dismissal. Validation is associated with the relevant input, and last-day actions use the theme's foreground token. |

## Shared pieces adopted

- `components/ui/Dialog.js`: artist onboarding/rejection/last day, payout history, earnings, consent editor, station last day, and subscription cancellation.
- `--color-success`, `--color-warning`, and `--color-danger` plus their surface/border variants: migrated status controls and alerts.
- `.studio-feature-grid` and `.studio-client-detail`: responsive rules supplied by the shared stylesheet.
- Existing text, surface, border, switch and accent tokens remain in use. Native controls also inherit global focus, disabled, motion and theme rules.

## Verification

All six edited page implementations passed parsing with the installed Next.js Babel preset. `git diff --check` passed. The root app review owns the combined production build and browser results; those should be read alongside this feature report.

These source checks do not establish live data correctness, full screen-reader support, colour contrast for every legacy component, or visual quality on every viewport. No account mutations, client communications, imports, payouts, or billing changes were executed as part of this feature review.

## Remaining work and limits

- Some older button, KPI, card and input style objects and fixed colours remain. Migrate these incrementally to the shared primitives; preserve chart-series colours and custom widget colours where they represent data or customer configuration.
- Financial charts still need a deliberate accessible data alternative and keyboard/screen-reader verification. A visual legend alone does not provide all chart values.
- Some error handlers currently present empty data after a failed fetch. Distinguishing failure from a real empty history needs a separate data-state change, especially for payout history, earnings and artist schedule data.
- Check the client detail panel with keyboard focus at narrow widths. It is a responsive detail surface rather than a modal and does not claim modal background isolation.
- Remaining settings controls should be checked against their visible labels, especially child components outside this page's ownership, and new English accessible strings should join the translation catalogue.
- Verify the authenticated end-to-end paths in both themes at desktop and narrow widths, 200% zoom, and with reduced motion: selecting a client/artist, editing schedule hours, navigating the onboarding steps, import mapping/progress, payout and earnings dialogs, consent editing, and switching settings sections. Exercise dialogs with Tab/Shift+Tab, Escape, backdrop dismissal, saving states and focus restoration.

