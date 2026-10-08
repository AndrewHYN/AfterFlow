<div align="center">

# AFTERGLOW

**Find your frequency.**

A personal atmosphere studio for focus, quiet evenings, and the moments in between.

[Open the studio](https://afterglow-studio.prettypine1.chatgpt.site) · [Source](https://github.com/AndrewHYN/AfterFlow)

</div>

---

AFTERGLOW combines original ambient sound with animated artwork and a simple mixing console. Choose a room, shape its sound, and save the atmosphere you want to return to.

The GitHub repository is named **AfterFlow**; the application’s brand is **AFTERGLOW**.

## Visual direction

Edition 03 keeps the warm editorial palette and adds layered room postcards, restrained pointer-driven perspective, soft surface highlights, a timer progress ring, and playback-responsive studio lighting. The reel reference informed the depth and animation direction; the implementation uses original CSS and JavaScript. All artwork is drawn with CSS; no image asset downloads are required. Motion respects the reduced-motion setting.

## The experience

- **One-tap rituals:** Study for 25 minutes, Wind down for 15 minutes, and Rain without music.
- **Return quickly:** continue the last played room or listen to a saved cloud mix from the homepage.
- **Four free rooms:** Midnight Drive, Rainy Window, Deep Focus, and Golden Hour.
- **Layered sound:** independently control three original synthesized textures in each room.
- **Focus timers:** choose 5–90 minutes, with a gentle fade when the session ends.
- **A personal library:** device favourites and account-owned custom mixes across devices.
- **Listening history:** recent sessions and listening minutes in your account.
- **Immersive view:** hide the controls and stay with the artwork; press Escape or tap the scene to return.
- **Account controls:** export your data or delete your studio records.
- **Accessible controls:** keyboard support, visible focus, reduced motion, and responsive layouts.

Audio is generated locally through the Web Audio API. No music recordings or external audio downloads are bundled. Artist suggestions are optional links to an external service.

## Plans

| Feature | Free | Plus |
|---|---|---|
| Atmosphere rooms | 4 | 8 |
| Listening, layers, timers | Included | Included |
| Custom cloud mixes | 3 | Up to 200 |
| Visible session history | 7 days | 1 year |
| Proposed price | $0 | USD $3/month or $24/year |

The four additional Plus rooms are Ocean Dusk, Forest Floor, Velvet Night, and Ember Room. They use different combinations of the original sound generators and their own artwork.

**Paid subscriptions are not live.** The application currently contains a disabled Stripe subscription adapter. Linkwa has been requested as the intended payment provider, but its credentials have not been copied from BidBlitz and no Linkwa adapter has been deployed. Automatic recurring billing through Linkwa has not been verified. Do not enable or advertise paid checkout until the chosen provider is integrated and tested end to end.

## Stack

| Part | Implementation |
|---|---|
| Interface | HTML, CSS, and vanilla JavaScript |
| Sound | Web Audio API |
| Server | Cloudflare Worker ES module |
| Cloud data | Cloudflare D1 / SQLite |
| Sign-in | Hosting platform’s ChatGPT authentication |
| Tests | Node’s built-in test runner and SQLite |
| Build | Dependency-free Node scripts |

No package installation is required. The build embeds the studio inside the Worker, so the deployment contains one server module plus hosting configuration and database migrations.

## Get started

Use **Node.js 24 or newer**. Tests use its built-in SQLite module.

```sh
git clone https://github.com/AndrewHYN/AfterFlow.git
cd AfterFlow
npm test
npm run build
npm run check
```

The build produces `dist/server/index.js` and `dist/.openai/`.

These commands validate and build the project; they do not start a local development server. The cloud API expects a D1 binding named `DB` and trusted identity supplied by the hosting platform. Opening `src/index.html` alone is not the full application: product functionality is assembled by the build.

## Project structure

```text
src/
  index.html              Studio layout, artwork, audio engine, and routing
  product.js              Accounts, custom mixes, plans, history, and help
  design.css              Editorial design, responsive artwork, and motion
worker/
  index.js                API, ownership checks, billing, and page delivery
drizzle/
  0000_afterglow.sql       Initial cloud database schema
  0001_usage_counts.sql    Optional aggregate usage and deduplication
  meta/_journal.json      Migration journal
scripts/
  build.mjs               Embed the frontend and package migrations
  check.mjs               Check embedded browser JavaScript
  validate-artifact.mjs    Verify the Worker module
tests/
  audio.test.mjs           Audio startup, cleanup, and timer tests
  product.test.mjs         Ownership, billing, usage, and data tests
  gallery.test.mjs         Swipe, scroll, cancellation, and deck tests
  rituals.test.mjs         Presets, gesture startup, and analytics consent tests
```

## Hosting and authentication

The current hosted studio is **private to its owner**. The link above is not a public commercial launch.

`.openai/hosting.json` identifies the existing hosted project and declares its database binding. Its project ID is configuration, not a credential. When creating an independent deployment, register a new project through the supported hosting workflow rather than reusing that ID.

The hosting dispatch layer supplies trusted `oai-authenticated-user-id` and `oai-authenticated-user-email` headers. The Worker authorizes cloud records using the site-specific user ID. **Do not deploy it unchanged behind a server that accepts those headers from arbitrary clients.** A different hosting platform requires a proper authentication adapter and equivalent ownership checks.

D1 migrations are applied by the hosting workflow before the Worker is deployed. Applied migration files must remain immutable; append a new migration for later schema changes.

## Payments and secrets

`.env.example` lists the current adapter’s configuration names and contains no real keys. Keep all credentials in the host’s secret settings; never commit them or expose them to browser code.

The disabled Stripe adapter implements:

- Hosted subscription checkout and a customer billing portal.
- Raw-body webhook signature verification.
- Customer-ID ownership mapping and provider-state reconciliation.
- Renewal, payment-failure, and cancellation handling.
- Known-price, active-status, and expiry checks for Plus access.

Checkout return URLs and client-supplied flags never grant Plus. The server grants access only from verified provider state.

Before any paid launch, complete merchant setup, support contact and operator information, applicable tax configuration, and sandbox verification of checkout, renewals, failed payments, cancellation, duplicate events, and expiry. Stripe merchant eligibility is not established for this project. Linkwa is the requested provider, but its [current FAQ](https://linkwa.co.zw/faqs) states that recurring payments are not supported. A Linkwa offering would therefore require explicitly renewed fixed-duration membership passes, not automatic subscriptions. Access to the existing BidBlitz environment secrets is currently denied by Vercel (403), so no Linkwa credentials were copied and no payment adapter was activated. Do not substitute one-off payment links for auto-renewing subscriptions without explaining the renewal model to users.

## Data ownership

Mixes and sessions belong to the authenticated account. All cloud reads and mutations enforce that ownership. Free mix creation checks its three-mix cap in the same SQL statement as insertion.

Device favourites and sound preferences use browser local storage. Cloud exports include the account’s studio records. Account deletion removes its cloud mixes, sessions, subscription mapping, and account record; an ongoing subscription must end first. Payment-provider records and the limited billing event ledger are separate from studio deletion.

Session history is client-reported and intended for personal reflection, not certified usage measurement. Views return at most 500 sessions; individual sessions are capped at six hours.

## Usage insights

Measurement is optional and off by default. The homepage and Privacy page provide the choice. Do Not Track and Global Privacy Control suppress events even when the choice is enabled. No third-party analytics scripts run.

The client reports visit days, return days, listening starts, preset selections, listening seconds and successful mix saves. The server validates the allowed signals and aggregates by UTC day, room and preset. Random one-event receipt IDs deduplicate delivery; counts and receipts expire after 90 days on subsequent event ingestion. They contain no account ID, email or IP address. Counts are directional, client-reported signals rather than audited figures, and visit days are per device rather than unique people.

`/#/insights` shows the last 30 days. `ANALYTICS_ADMIN_USER_ID` must contain the owner’s trusted **site-specific** user ID; it was configured from the sole live user whose email matched the Site owner. The backend rejects anonymous users and other accounts, and Account exposes the link only to that configured owner. Changing the site audience does not relax this authorization.

## Verification

**53 automated tests passed** in the current release:

- Audio sources start once and stop cleanly.
- Old timer callbacks cannot stop a newly started session.
- Cloud reads and writes enforce account ownership.
- Free and Plus limits are enforced by the server.
- Webhook signatures reject tampering and invalid deliveries.
- Renewal, failure, cancellation, and replay scenarios are covered with mocked provider responses.
- Exports and account deletion remain scoped to the owner.

Build, embedded JavaScript syntax, and Worker artifact checks also pass. The deployed D1 schema was confirmed to contain `users`, `mixes`, `sessions`, `subscriptions`, and `billing_events`.

**Verification limits:** desktop/mobile visual QA and real hosted sign-in have not been browser-tested. No real payment-provider sandbox or live subscription has been exercised for AFTERGLOW. Mobile browsers can suspend audio when the device locks or the tab moves into the background.

## Motion edition 04

The homepage postcards gently wiggle twice to invite interaction, then settle. Swipe the front card left or right to cycle through all four free rooms; tapping opens the current room. Arrow buttons and keyboard arrow keys provide the same navigation. Vertical touch scrolling remains native, real drags suppress link activation, and reduced-motion preferences disable decorative motion. Buttons respond to presses and the studio play ring breathes during playback.

## Launch readiness

1. Restore authorized access to the existing Linkwa secrets; no repeated unchanged retry or credential substitution.
2. Implement and sandbox-test explicitly renewed membership passes, including amount/currency checks, signed events, server-side payment verification, idempotent grants and expiry. Automatic renewal is unavailable on Linkwa today.
3. Complete real Android and desktop browser checks of one-tap audio, account sign-in, saving and replaying cloud mixes. The managed environment has no supported browser QA capability; browser/device verification remains pending.
4. Supply merchant/support details and final membership terms, then explicitly authorize a public launch. The current site remains private to its owner.
5. Promote the free study/rain rituals first and use opt-in return/listening signals to decide what to improve.

Built by Andrew Hama Mutamiri.
