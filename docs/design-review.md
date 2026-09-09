# Vanta Studio web design review

Reviewed 9 September 2026. This pass strengthens the existing web design language and applies it across the app. The component reference is [design-system.md](design-system.md); the full source inventory is [design-inventory.md](design-inventory.md).

## App coverage

| Area | Changes |
| --- | --- |
| Shared foundation | Dark/light surface, text, status, border, spacing, radius, motion and control tokens; reusable Button, IconButton, Field, Input, Select, Textarea, StatePanel and Dialog. Visible keyboard focus, disabled/loading states, coarse-pointer sizing and reduced motion apply globally. |
| Authentication and signup | Sign-in adopts shared fields, actions and feedback states. Labels, loading and success/error colours are consistent. Signup fields share label semantics; feature cards open with Enter/Space, feature selection exposes state, and details use the shared modal. The marketing region explicitly retains its dark palette. |
| Dashboard shell and Home | Navigation identifies the current page. Loading and failed dashboard requests use the shared state surface with an actionable retry. |
| Appointments and Schedule | Search/filter/view/date-navigation controls expose names and selection. Appointment empty/error states use the shared panel. Booking-status colours come from the shared semantic mapping. |
| Booking detail and creation | Detail close actions and state colours use shared controls/tokens. Notes and form controls have names; date fields inherit the active theme. Creation choices expose selection, station controls disable when the time is invalid, and client search results support keyboard activation. Submission uses the shared loading button. |
| Booking actions | Complete, Reject and Send Selection Link use shared dialogs, fields and buttons. Saving guards dismissal and repeated activation. Existing amounts, booking transitions and requests remain owned by their feature code. |
| Analytics/Revenue, Financial, Artists, Clients, Import and Settings | Shared modal adoption, semantic status colours, responsive grids, named controls and keyboard interactions. Import progress retains its total during processing. See [dashboard-review.md](dashboard-review.md) for the feature findings. |
| Quick actions | Client lookup and reimbursement use the same native modal. Search results are native buttons, reimbursement fields use shared controls, and saving disables edits/dismissal. |
| Public studio booking | Explicit dark-theme scope prevents a saved light preference leaking into the public form. Fields and submission use shared primitives; placement/size/colour choices expose selection, guardian and consent controls have names, and photo upload can be opened from the keyboard. Muted text uses readable tokens. |
| Global feedback | Confirmations use the shared alertdialog. Notices follow modal opening order, including a confirmation mounted earlier in the DOM than its underlying dialog. Native keyboard handling includes portalled notification actions; notices return to the underlying surface when a modal closes. |

The redundant local field/dialog implementations and their unused styles were removed where migrated. Calendars, data tables, feature artwork, customer-configured widget colours and other feature layouts retain their own presentation code. This is an app-wide review and adoption pass, not a claim that every inline style has been replaced.

## Verification

- The final Next.js production build passed and exported all 17 static pages. The production gallery HTML was checked: it renders the not-found page and does not render the preview. The local build used the installed x64 Node executable to match the repository's installed x64 Next.js compiler; no dependency or lockfile changes were needed. The build emitted a Supabase notice that Node 20 support is deprecated.
- All 44 app, component and library JavaScript sources parsed with the installed Next.js Babel preset; `git diff --check` passed.
- `node scripts/check-theme.mjs` passed: server rendering, persisted preferences, initialization before paint, invalid values, all storage blocked, and reads allowed with writes denied. A denied write no longer restores a stale preference on settings reads or reinitialization.
- `scripts/design-system-smoke.cjs` passed in Chromium against the local development server. It checks both themes, visible keyboard focus, connected field errors, disabled/loading buttons, Tab/Shift+Tab containment, Escape/backdrop saving guards, nested dialogs, portalled notices/actions, modal opening order, focus return, scroll restoration, 360 px layout bounds, reduced motion, sign-in/signup labels, keyboard feature details and keyboard photo selection. The public booking screen uses intercepted GET requests with local fixtures.
- Screenshots were inspected for the shared gallery, narrow dialog, light sign-in and public booking form. No live booking, signup, import, payment, reimbursement or billing submission was executed.

## Repeating the checks

```sh
node scripts/check-theme.mjs
node scripts/audit-design-system.mjs
npm run build
```

For browser checks, run a separate local development server, then use an installed Playwright distribution with its Chromium browser:

```sh
STUDIO_TEST_URL=http://127.0.0.1:3007 STUDIO_PLAYWRIGHT_PATH=/absolute/path/to/playwright node scripts/design-system-smoke.cjs
```

The `/design-system` gallery is available only in development and contains no live account actions. It returns not-found in production. The browser checks write screenshots to `/private/tmp`.

## Verification limits

Authenticated dashboard flows still need visual and interaction checks with representative account data in both themes, including enlarged text and narrow layouts. Build/source checks cover those routes; the browser smoke does not claim to exercise their live data operations. Safari, Firefox, screen-reader combinations and real mobile browsers were not exercised in this web pass.

The public signature pad still requires pointer/touch drawing. A keyboard alternative needs a deliberate change to signature capture and consent handling. Charts also need a complete accessible data alternative, and older fetch handlers in several financial/artist views still conflate failures with empty history. These existing feature gaps are recorded separately from the shared component checks. New English accessible strings should join the translation catalogue as those features are localized.
