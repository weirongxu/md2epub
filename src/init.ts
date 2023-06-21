import fs from 'fs'
import path from 'path'
export async function initBy() {
  const filename = 'epub-builder.yaml'
  const tplPath = path.join(__dirname, '..', filename)
  const content = fs.readFileSync(tplPath)
  fs.writeFileSync(filename, content)
}
