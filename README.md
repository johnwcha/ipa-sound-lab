# 词间 · 英语词库

Mobile-first vocabulary notebook. Enter an English word or short phrase to save its Simplified Chinese meaning, part of speech, British and American IPA (when available), pronunciation buttons, word forms, and example sentences. Guest data stays in this browser. Google sign-in enables Firebase synchronization across devices.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the address shown by Vite, normally `http://localhost:5173`.

```bash
npm run build
npm run lint
```

## Data sources and limitations

- Chinese meanings and inflections come from the bundled [ECDICT](https://github.com/skywind3000/ECDICT) dataset. It is MIT licensed, **not public domain**; see [DICTIONARY_LICENSE.txt](DICTIONARY_LICENSE.txt). The bundled shards allow Chinese lookup without a network connection.
- Accent-specific IPA is bundled from [ipa-dict](https://github.com/open-dict-data/ipa-dict). Its US and UK data have different upstream licenses, including MIT and GPL 3.0; consult that project's credits before redistributing the IPA data. Audio recordings and some examples come from the free [Dictionary API](https://dictionaryapi.dev/), which draws from Wiktionary (generally CC BY-SA). Individual audio may have separate licenses.
- Example sentences are also fetched from [Tatoeba](https://tatoeba.org/) under CC BY 2.0 FR. Sentence credits link to the author and original sentence in the details panel.
- Some entries have no distinct British or American IPA, audio, or examples. The app displays that gap rather than inventing an accent transcription. If no recording exists, the audio button uses the browser's text-to-speech voice.
- If ECDICT has no entry for a word or phrase, the app offers manual entry for the Chinese meaning. Other fields stay empty until a source provides them.
- Guest words live in this browser only. Clearing site data removes guest data and unsynchronized local changes. Signed-in users can reload acknowledged cloud data on another device.

## Firebase setup and deployment

The dedicated project is `ipa-sound-lab-sync-jw-20261011`, with the default Firestore Standard database in `us-west1`. Google sign-in is enabled. Billing is disabled (Spark). Production uses the public Firebase web configuration in `.env.production`; these identifiers are shipped to browsers and are not admin credentials. Database access is enforced by `firestore.rules`. Never add service-account keys or OAuth client secrets to Vite environment variables.

For local development, copy `.env.example` to `.env.local` and fill in the four values from Firebase Console → Project settings → Your apps → Web app. `.env.local` is ignored. Without complete configuration, the app remains usable in guest mode and hides Google sign-in. For an intentionally unconfigured production build, leave all four variables empty.

To set up another project:

1. Create a Spark project without linking a billing account. Enable the Firestore API and create exactly one Standard database in `us-west1`.
2. In Authentication, choose Get started, then enable Google with a project support email. Do not upgrade to Identity Platform for this app.
3. Add `localhost`, `127.0.0.1`, and the actual website hostname under Authentication → Settings → Authorized domains. Keep the generated Firebase auth domains.
4. Register a Web app, update the four public variables and `.firebaserc`, then deploy the rules and indexes: `npx firebase deploy --only firestore --project YOUR_PROJECT_ID`.
5. Build with `npm run build` and deploy `dist` to the existing static host. The Firebase auth domain serves the popup/redirect handler; it must remain available.

Google popup cancellation leaves the app in guest mode. Blocked/unsupported popups fall back to redirect. Third-party storage restrictions can affect redirect sign-in; test the popup path on target mobile browsers before rollout.

## Sync, migration, and recovery

- Data is isolated under `users/{uid}`: `vocabulary`, `quizRounds`, `studySessions`, and `imports`. Signed-out users cannot access these records. Vocabulary deletion uses tombstones; rounds, completed sessions, and imports allow only creation or identical retries.
- Web persistence uses IndexedDB and supports multiple tabs. Offline edits are queued by Firestore and sync after reconnecting. If IndexedDB is unavailable, the app uses a memory cache and blocks signed-in offline edits. Cached account data may remain on the device after sign-out; the interface immediately returns to the separate guest library. Use trusted browser profiles for account sync.
- One document represents one word, one completed round, or one completed study session. Running timers and unfinished quizzes remain local. Personal writes have an account-scoped recovery journal until the cloud acknowledges them; failed writes remain exportable and retryable. On recovery, existing immutable history is preserved and newer timestamped vocabulary wins over older journal entries. Sign-out is blocked while writes or failed retries remain unresolved.
- Vocabulary conflicts use last-write-wins. Quiz totals are derived from immutable rounds; review status applies outcomes by completion time and stable ID. Study statistics use the viewing device's local date and include both devices' sessions, including overlapping sessions.
- After the first successful cloud load, an import card previews guest data. Import or dismiss it; the account menu offers it again later. Migration requires connectivity, preserves cloud vocabulary/tombstones, and resumes safely after interruption. Original v1 browser keys remain intact.
- Legacy quiz history contains only counters. Imports take the maximum legacy counters across devices and union missed terms, then apply actual new round outcomes. Independent old histories therefore cannot be summed reliably. Newly completed rounds retain their individual identities.
- Use Account & backup → Export JSON for manual recovery. JSON import validates the file and previews a merge without replacing existing records. Backups include tombstones and record IDs. Export pending changes before clearing browser data.

## Checks and pilot rollout

```bash
npm test
npm run test:rules
npm run build
npm run lint
```

Rules tests require Java 21+ and start a disposable Firestore emulator with project ID `demo-vocab-sync`; they never touch the production database. `npm test` runs model and account-flow tests and skips emulator tests unless `FIRESTORE_EMULATOR_HOST` is set. The account tests simulate connectivity, auth changes, popup failures, and pending/rejected writes.

Pilot checklist: use two browser profiles with the same Google account; import once; add and delete words on both; complete rounds concurrently; go offline, edit, reload and reconnect; confirm study crash recovery; sign out and verify the guest library; test JSON export/import and mobile sign-in. Real Google authentication requires interactive user participation and is separate from emulator verification.

Spark's Firestore quota is 1 GiB stored data, 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day, and 10 GiB outbound transfer/month. Daily quotas reset around midnight Pacific time. Exceeding free quotas can interrupt cloud operations; do not enable billing automatically. Inspect Firebase Console → Firestore → Usage during the pilot. Snapshot listeners and reconnections consume reads, so the app keeps one listener per collection rather than fetching on every screen change. Dictionary/IPA assets and audio are not uploaded to Firestore. Managed backups and point-in-time recovery require billing; manual JSON backups remain available. See [Firebase pricing](https://firebase.google.com/pricing) and [Firestore quotas](https://firebase.google.com/docs/firestore/quotas).

The source CSV is converted into small static JSON shards with `scripts/build-dictionary.mjs`. To rebuild them, download `ecdict.csv` from the ECDICT repository, then run `node scripts/build-dictionary.mjs path/to/ecdict.csv`. The IPA shards can be rebuilt with `node scripts/build-ipa.mjs path/to/en_UK.txt path/to/en_US.txt`.
