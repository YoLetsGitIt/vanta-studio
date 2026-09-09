# Vanta Studio web design system

Vanta Studio uses its existing warm, neutral visual language and Space Grotesk font. Shared web tokens live in `app/globals.css`; reusable controls live in `components/ui`. The iOS and Android implementations have separate platform components.

## Tokens and themes

Use CSS variables in component styles. Do not copy resolved colour values into a component, append hexadecimal alpha values to `var(...)`, or assume that a pale status colour works on a light surface.

| Purpose | Tokens |
| --- | --- |
| Surfaces | `--bg-base`, `--bg-sidebar`, `--bg-panel`, `--bg-modal`, `--bg-card`, `--bg-input`, `--bg-chip`, `--bg-row-active` |
| Text | `--text`, `--text-dim`, `--text-muted`; legacy secondary/faint/ghost aliases remain readable |
| Dividers | `--border-faint`, `--border`, `--border-strong` |
| Interactive boundaries | `--control-border`, `--focus-ring`, `--focus-ring-width` |
| Primary action | `--accent`, `--accent-contrast`, `--accent-tint`, `--accent-tint-border` |
| Semantic feedback | `--color-success`, `--color-warning`, `--color-danger`, `--color-info`; each has `-surface` and `-border` tokens |
| Destructive filled action | `--color-danger`, `--color-on-danger` |
| Spacing | `--space-1` to `--space-8`: 4, 8, 12, 16, 24, 32, 48, 64 px at the default root font size |
| Radii | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-pill` |
| Controls | `--control-height-sm` (32 px), `--control-height-md` (40 px), `--control-height-lg` (48 px), `--target-size-touch` (44 px minimum) |
| Typography | `--font-body`, `--font-size-xs/sm/md/lg`, `--line-height-body` |
| Elevation and motion | `--shadow-card`, `--shadow-modal`, `--overlay-backdrop`, `--duration-fast`, `--duration-normal` |

Both themes define their own semantic foregrounds and surfaces. Status badges should pair the foreground with the matching surface and show a text label; colour alone does not convey state. Existing `--status-*` variables resolve to semantic tokens or subdued text. `lib/status.js` remains the shared booking-status mapping.

The default is dark. `lib/theme.js` validates persisted values, applies the chosen theme even when local storage is unavailable, and supports server rendering. The root layout runs `getThemeInitScript()` before page content to apply the stored preference without waiting for hydration. It writes only the allowlisted values `dark` and `light`.

Use `setTheme('light')` or `setTheme('dark')` for preference changes. A deliberately dark marketing region can use `data-theme="dark"`; it resets the entire token palette even inside the light theme. Native inputs and menus inherit the corresponding `color-scheme`.

## Shared controls

### Buttons

```jsx
import Button, { IconButton } from '@/components/ui/Button';

<Button type="submit" loading={saving} loadingLabel="Saving…">Save changes</Button>
<Button variant="secondary" onClick={onCancel}>Cancel</Button>
<Button variant="danger" onClick={onDelete}>Delete draft</Button>
<IconButton aria-label="Close details" onClick={onClose}>{closeIcon}</IconButton>
```

`Button` supports `primary`, `secondary`, `ghost`, and `danger` variants; `sm`, `md`, and `lg` sizes; `fullWidth`; standard button attributes; and forwarded refs. The default type is `button`, so form submissions must explicitly use `type="submit"`. Loading disables repeated activation, exposes `aria-busy`, and keeps the original label unless `loadingLabel` is supplied. Always give `IconButton` an accessible name with `aria-label` or `aria-labelledby`. Use links for navigation rather than a button that imitates a link.

### Fields

```jsx
import Field, { Input, Select, Textarea } from '@/components/ui/Field';

<Field label="Email" hint="Booking updates go to this address." error={emailError} required>
  <Input type="email" autoComplete="email" value={email} onChange={onEmailChange} />
</Field>
<Field label="Reason">
  <Textarea value={reason} onChange={onReasonChange} />
</Field>
<Field label="Artist">
  <Select value={artistId} onChange={onArtistChange}>{artistOptions}</Select>
</Field>
```

`Field` connects its visible label, hint, and error to a single child control with a stable ID. Errors set `aria-invalid` and use an alert region. Native required state is preserved; the decorative asterisk is hidden from assistive technology. `Input`, `Select`, and `Textarea` accept native attributes, `invalid`, classes, styles, and refs.

A custom control must forward the `id`, `required`, `aria-invalid`, and `aria-describedby` props to its actual input. For a wrapper containing multiple elements, provide an explicit matching field/input ID and connect hint/error IDs yourself, or extract a forwarding control. Use `fieldset` and `legend` for related checkbox/radio groups. A placeholder does not replace a visible label.

### Loading, empty and feedback states

```jsx
import StatePanel from '@/components/ui/StatePanel';

<StatePanel busy title="Loading appointments…" />
<StatePanel title="No appointments yet" description="New bookings will appear here." />
<StatePanel
  tone="error"
  title="Appointments could not be loaded"
  description={errorMessage}
  action={<Button variant="secondary" onClick={retry}>Try again</Button>}
/>
```

`StatePanel` supports `neutral`, `error`, `warning`, `success`, and `info` tones, plus `busy`, `icon`, `action`, `compact`, children, and standard div attributes. Errors are assertive alerts; other states are polite status updates. Decorative icons and spinners are hidden from assistive technology. A loading message remains visible when reduced motion disables its spinner. Keep retry actions connected to the existing request lifecycle; an empty list is different from a failed request.

### Dialogs

Use `components/ui/Dialog` for blocking dialogs. It provides a native modal, heading/description connections, contained keyboard focus, Escape/backdrop dismissal, scroll locking, and focus restoration. Its `footer` can contain shared buttons, and `initialFocusRef` can target the least destructive action. Set `dismissDisabled` during an operation that must finish before closing. Keep confirmation messages and payment/booking logic in the consuming component.

## Accessibility and responsive behaviour

Global keyboard focus uses a visible, theme-specific outline, including legacy controls with inline `outline: none`. Preserve that focus treatment in feature CSS. Disabled controls remain native disabled elements and have a consistent cursor/opacity treatment. Shared inputs preserve distinct error and focus states.

Coarse-pointer devices receive 44 px minimum button/control heights, with existing switch controls excluded from that global button rule. Text inputs use at least 16 px on those devices to avoid focus zoom. `prefers-reduced-motion` stops repeating loading motion and shortens other animations/transitions. The `.sr-only` utility is available for text that should be announced without being displayed.

Use `studio-feature-grid`, `studio-feature-header`, and `studio-feature-body` for the common responsive grid/padding adjustments. The client detail drawer uses `studio-client-detail` to fill its containing page at narrow widths. Feature-specific calendars and data tables can scroll within their own containers; preserve their labels and controls when changing layouts.

## Validation and adoption

See [design-review.md](design-review.md) for app-wide coverage, executable checks and verification limits. Run `node scripts/check-theme.mjs` to repeat the theme regression checks, including storage writes failing while reads still work.

Run `node scripts/check-theme.mjs` for the retained theme regression checks. These cover persisted dark/light themes, invalid saved values, unavailable storage, storage that allows reads but denies writes, server-side calls, and the initialization script. The active page theme takes precedence over stale storage after initialization, so a denied write cannot undo the user's current choice. Calculated contrast for the least prominent text is 5.02:1 against the dark input surface and 4.82:1 against the light sidebar. Shared control borders exceed 3.3:1 against input surfaces, and semantic text exceeds 5.4:1 against its matching feedback surface. These checks concern the token pairs, not every combination in every feature screen.

Shared controls, primary feedback states, booking/payment dialogs, and multiple dashboard routes adopt these foundations. Legacy inline styles still exist, especially in dense scheduling, editor, and onboarding layouts. Migrate a touched control to the shared primitive instead of creating another local button/field implementation. Review both themes, keyboard operation, narrow layouts, enlarged text, and reduced motion when changing a feature. Automated build/browser results and remaining feature findings belong in the app-wide design review; this guide is the implementation reference, not a claim that all visual or assistive-technology combinations have been verified.
