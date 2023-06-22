import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))

export async function initBy(lang: string | undefined) {
  const filename = 'epub-builder.yaml'
  const sourceFilename = lang ? `epub-builder.${lang}.yaml` : filename
  const tplPath = path.join(dir, '../template', sourceFilename)
  const content = fs.readFileSync(tplPath)
  fs.writeFileSync(filename, content)
}
