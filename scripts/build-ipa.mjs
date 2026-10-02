import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [ukPath, usPath] = process.argv.slice(2)
if (!ukPath || !usPath) throw new Error('Usage: node scripts/build-ipa.mjs <en_UK.txt> <en_US.txt>')
const output = resolve('public/ipa')
mkdirSync(output, { recursive: true })
const shards = new Map()

for (const [path, index] of [[ukPath, 0], [usPath, 1]]) {
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const [rawWord, ipa] = line.split('\t')
    const word = rawWord?.trim().toLowerCase()
    if (!word || !ipa || !/^[a-z][a-z '-]*[a-z]$|^[a-z]$/i.test(word)) continue
    const prefix = word.slice(0, 2).replace(/[^a-z]/g, '_').padEnd(2, '_')
    if (!shards.has(prefix)) shards.set(prefix, {})
    const shard = shards.get(prefix)
    if (!shard[word]) shard[word] = ['', '']
    shard[word][index] = ipa.split(',')[0].trim()
  }
}

for (const [prefix, data] of shards) writeFileSync(resolve(output, `${prefix}.json`), JSON.stringify(data))
console.log(`Wrote ${shards.size} IPA shards.`)
