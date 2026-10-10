# Studio walkthrough captures

These PNGs are browser screenshots of this repository's actual public booking form and Studio dashboard, captured using local sample API responses. No live customer records are used and no enquiry, email, payment or consent is submitted.

- `booking-form`, `booking-form-details`: `/studio-booking`, client details and tattoo fields.
- `enquiry`, `availability`, `selection`, `confirmed`: `/dashboard/appointments`, booking detail panel at the corresponding status.
- `estimate`: the existing Send selection link dialog, opened without sending.
- `consent`, `consent-signed`: `/dashboard/clients`, the example client's consent status.
- `feature-schedule`, `feature-artists`, `feature-finances`, `feature-analytics` (and their `-mobile` versions): actual dashboard pages for the studio feature explorer, using fictional local responses. Recreate with `scripts/capture-feature-screens.cjs` and the same environment variables below. The financial page's local sample browser session is unlocked without submitting a password or contacting a real account.

Recreate after building and serving the static export:

```sh
STUDIO_PLAYWRIGHT_PATH=/path/to/playwright STUDIO_TEST_URL=http://127.0.0.1:4173 node scripts/capture-journey-screens.cjs
```

Use `--forms-only` to update just the two public form captures. The script intercepts all non-local requests with sample responses. Captures use the dark theme, a 460px viewport and 2× pixel density; dashboard captures focus on the relevant panel. The walkthrough displays them as images, not interactive forms.
