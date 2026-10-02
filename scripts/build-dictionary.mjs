import { createReadStream, mkdirSync, writeFileSync } from 'node:fs'
import { parse } from 'csv-parse'
import { resolve } from 'node:path'

const input = process.argv[2]
if (!input) throw new Error('Usage: node scripts/build-dictionary.mjs <ecdict.csv>')

const output = resolve('public/dictionary')
mkdirSync(output, { recursive: true })
const buckets = new Map()
const valid = /^[a-z][a-z '-]*[a-z]$|^[a-z]$/i
let total = 0

const parser = createReadStream(input).pipe(parse({ columns: true, relax_quotes: true, skip_records_with_error: true }))
for await (const row of parser) {
  const word = row.word?.trim().toLowerCase()
  const translation = row.translation?.trim()
  if (!word || !translation || !valid.test(word) || word.length > 56) continue
  const prefix = word.slice(0, 2).replace(/[^a-z]/g, '_').padEnd(2, '_')
  if (!buckets.has(prefix)) buckets.set(prefix, {})
  buckets.get(prefix)[word] = [translation, row.pos ?? '', row.exchange ?? '']
  total++
}

for (const [prefix, entries] of buckets) {
  writeFileSync(resolve(output, `${prefix}.json`), JSON.stringify(entries))
}
console.log(`Wrote ${total} English–Chinese entries to ${buckets.size} dictionary shards.`)
