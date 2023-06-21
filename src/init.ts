import fs from 'fs'
import path from 'path'
export async function initBy(lang: string | undefined) {
  const filename = lang ? `epub-builder.${lang}.yaml` : 'epub-builder.yaml'
  const tplPath = path.join(__dirname, '../template', filename)
  const content = fs.readFileSync(tplPath)
  fs.writeFileSync(filename, content)
}
