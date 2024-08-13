import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))

export async function initBy(lang: string | undefined) {
  const filename = 'md2epub.yaml'
  const sourceFilename = lang ? `md2epub.${lang}.yaml` : filename
  const tplPath = path.join(dir, '../template', sourceFilename)
  const content = fs.readFileSync(tplPath)
  fs.writeFileSync(filename, content)
}
