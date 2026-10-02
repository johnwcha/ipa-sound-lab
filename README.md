# 词间 · 英语词库

Mobile-first vocabulary notebook. Enter an English word or short phrase to save its Simplified Chinese meaning, part of speech, British and American IPA (when available), pronunciation buttons, word forms, and example sentences. Entries persist in the browser's local storage.

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
- Saved words live in this browser only. Clearing site data will remove them.

The source CSV is converted into small static JSON shards with `scripts/build-dictionary.mjs`. To rebuild them, download `ecdict.csv` from the ECDICT repository, then run `node scripts/build-dictionary.mjs path/to/ecdict.csv`. The IPA shards can be rebuilt with `node scripts/build-ipa.mjs path/to/en_UK.txt path/to/en_US.txt`.
