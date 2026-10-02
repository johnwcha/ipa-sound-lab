# IPA data sources

The `public/ipa` shards are derived from the `en_UK.txt` and `en_US.txt` files in [open-dict-data/ipa-dict](https://github.com/open-dict-data/ipa-dict).

- English (UK) IPA is derived by that project from `ipacards` by leoboiko, licensed under GPL 3.0. A copy of GPL 3.0 is in [IPA_UK_GPL-3.0.txt](IPA_UK_GPL-3.0.txt).
- English (US) IPA is based on a modified `cmudict-ipa` by Lingliang Zhang, with stress markers using `syllabify` by Kyle Gorman. The ipa-dict credits identify MIT terms for these sources.

The build script converts tab-separated word–IPA entries to separate JSON files indexed by the first two characters. It selects the first pronunciation listed for each entry and changes no IPA symbols.
