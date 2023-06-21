import fs from 'fs'
import path from 'path'
export async function initBy(lang: string | undefined) {
  const filename = 'epub-builder.yaml'
  const sourceFilename = lang ? `epub-builder.${lang}.yaml` : filename
  const tplPath = path.join(__dirname, '../template', sourceFilename)
  const content = fs.readFileSync(tplPath)
  fs.writeFileSync(filename, content)
}
