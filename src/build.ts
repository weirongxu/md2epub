import fs from 'fs'
import yaml from 'yaml'
import JSZip from 'jszip'
import { v4 as uuidv4 } from 'uuid'
import mime from 'mime-types'
import MarkdownIt from 'markdown-it'
import dedent from 'dedent'
import path from 'path'
import { JSDOM } from 'jsdom'
import { imageSize } from 'image-size'

type Config = {
  author: string
  title: string
  lang: string
  uuid?: string
  publisher?: string
  cover?: string
  default_title?: string
  cover_title?: string
  nav_title?: string
  media_folder?: string
  spine: ConfigSpineNode[]
}

type ConfigSpineNodeObj = {
  title?: string
  path?: string
  anchor?: string
  nodes?: ConfigSpineNode[]
  nav?: boolean
  cover_page?: string
  nav_page?: boolean
}

type ConfigSpineNode = string | ConfigSpineNodeObj

type NavNode = {
  title: string
  href?: string
  nodes: NavNode[]
}

const md = new MarkdownIt()

function htmlToXHtml(html: string) {
  const jsdom = new JSDOM()
  const win = jsdom.window
  const doc = new win.DOMParser().parseFromString(html, 'text/html')
  const result = new win.XMLSerializer().serializeToString(doc.body)
  return result
}

function mdRender(mark: string) {
  return htmlToXHtml(md.render(mark))
}

class ContentBuilder {
  #idNum = 1
  #manifestItems = new Map<
    string,
    {
      id: string
      content: string | Buffer | false
      properties?: string
    }
  >()
  #spineItems: string[] = []
  #nav: NavNode[] = []
  importStyle = ''

  static build(config: Config) {
    const contentBuilder = new ContentBuilder(config)
    return contentBuilder.build()
  }

  constructor(public config: Config) {}

  renderXHtml({
    title,
    head,
    body,
    wrapBody = true,
  }: {
    title: string
    head: string
    body: string
    wrapBody?: boolean
  }) {
    const bodyContent = wrapBody ? `<body>${body}</body>` : body
    return dedent`
      <?xml version='1.0' encoding='utf-8'?>
      <html xmlns:epub="http://www.idpf.org/2007/ops" xmlns="http://www.w3.org/1999/xhtml" xml:lang="${this.config.lang}">
        <head>
          <title>${title}</title>
          ${head}
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
        </head>
        ${bodyContent}
      </html>
    `
  }

  defaultCoverTitle() {
    return this.config.cover_title ?? 'Cover'
  }

  defaultNavTitle() {
    return this.config.nav_title ?? 'Navigation'
  }

  defaultNoTitle() {
    return this.config.default_title ?? '[No Title]'
  }

  addStyle() {
    this.importStyle = dedent`
      <link href="page-styles.css" rel="stylesheet" type="text/css"/>
      <link href="stylesheet.css" rel="stylesheet" type="text/css"/>
    `
    this.addManifest(
      'page-styles.css',
      dedent`
        @page {
          margin-bottom: 5pt;
          margin-top: 5pt
        }
      `,
      {
        id: 'page-styles',
      }
    )
    this.addManifest(
      'stylesheet.css',
      dedent`
        rt {
          user-select: none;
        }
        img {
          max-width: 100%;
        }
        table {
          border-collapse: collapse;
        }
        table, th, td {
          border-width: 1px;
          border-style: solid;
        }
        th, td {
          padding: 2px;
        }
      `,
      {
        id: 'stylesheet',
      }
    )
  }

  addCover() {
    if (!this.config.cover) return
    this.addManifest(this.config.cover, fs.readFileSync(this.config.cover), {
      id: 'cover',
      properties: 'cover',
    })
  }

  addMediaFolder(folder: string) {
    const files = fs.readdirSync(folder)
    for (const file of files) {
      const absPath = path.join(folder, file)
      const stat = fs.statSync(absPath)
      if (stat.isDirectory()) {
        this.addMediaFolder(absPath)
      } else {
        this.addManifest(absPath, fs.readFileSync(absPath), {
          id: file,
        })
      }
    }
  }

  addSpine(spineNodes: ConfigSpineNode[], navList: NavNode[]) {
    for (const spineNode of spineNodes) {
      let node = spineNode
      if (typeof node === 'string') node = { path: node }

      let id: string | undefined
      let htmlTitle: string | undefined
      let href = node.path
      const navNodes: NavNode[] = []

      if (node.path) {
        const r = this.genNormalPage(node.path)
        id = r.id
        htmlTitle = r.title
        href = r.href
      } else if (node.cover_page) {
        const r = this.genCoverPage(node.cover_page)
        id = r.id
        htmlTitle = r.title
        href = r.href
      } else if (node.nav_page) {
        id = 'nav'
        htmlTitle = this.defaultNavTitle()
        href = 'nav.xhtml'
      }
      if (id) this.#spineItems.push(id)
      if (node.nav ?? true) {
        const title =
          node.title ??
          htmlTitle ??
          (node.path ? path.basename(node.path, path.extname(node.path)) : null)
        if (title) {
          href = node.anchor ? `${href}#${node.anchor}` : href
          navList.push({
            title,
            href,
            nodes: navNodes,
          })
        }
      }
      if (node.nodes) {
        this.addSpine(node.nodes, navNodes)
      }
    }
  }

  genNormalPage(path: string) {
    const queryTitle = (html: string) => {
      let title: string | undefined
      const jsdom = new JSDOM(html)
      const win = jsdom.window
      const doc = win.document
      const selectors = ['title', 'h1', 'h2', 'h3', 'h4', 'h5']
      for (const selector of selectors) {
        const text = doc.querySelector(selector)?.textContent
        if (text) {
          title = text
          break
        }
      }
      return title ?? this.defaultNoTitle()
    }

    let storePath = path
    let content: string | Buffer
    let title: string | undefined
    if (path.endsWith('.md')) {
      storePath = `${path}.xhtml`
      const body = mdRender(fs.readFileSync(path, 'utf8'))
      title = queryTitle(body)
      content = this.renderXHtml({
        title,
        head: this.importStyle,
        body,
        wrapBody: false,
      })
    } else if (path.endsWith('.html')) {
      content = fs.readFileSync(path, 'utf8')
      title = queryTitle(content)
    } else {
      content = fs.readFileSync(path)
    }

    return { title, id: this.addManifest(storePath, content), href: storePath }
  }

  genCoverPage(path: string) {
    const dimensions = imageSize(path)
    const title = this.defaultCoverTitle()
    const coverHtml = this.renderXHtml({
      title,
      head: dedent`
        <style type="text/css" title="override_css">
          @page { padding: 0pt; margin:0pt }
          body { text-align: center; padding:0pt; margin: 0pt; }
        </style>
      `,
      body: dedent`
        <div>
          <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="100%" height="100%" viewBox="0 0 ${dimensions.width} ${dimensions.height}" preserveAspectRatio="none">
            <image width="${dimensions.width}" height="${dimensions.height}" xlink:href="${path}"/>
          </svg>
        </div>
      `,
    })
    const href = 'cover_page.xhtml'
    return {
      title,
      id: this.addManifest(href, coverHtml, {
        id: 'cover-page',
        properties: 'svg',
      }),
      href,
    }
  }

  addManifest(
    path: string,
    content: string | Buffer | false,
    options: {
      id?: string
      properties?: string
    } = {}
  ) {
    let id: string
    const manifestItem = this.#manifestItems.get(path)
    if (!manifestItem) {
      id = options.id ?? `id${this.#idNum}`
      this.#idNum += 1
      this.#manifestItems.set(path, {
        id,
        content,
        properties: options.properties,
      })
    } else {
      id = manifestItem.id
    }
    return id
  }

  manifestItems() {
    const items: string[] = []
    for (const [filepath, value] of this.#manifestItems) {
      const filename = path.basename(filepath)
      const contentType = mime.contentType(filename)
      if (contentType)
        items.push(
          `<item href="${filepath}" id="${
            value.id
          }" media-type="${contentType}" ${
            value.properties ? `properties="${value.properties}" ` : ''
          }/>`
        )
    }
    return items
  }

  spineItems() {
    return this.#spineItems.map((id) => `<itemref idref="${id}" />`)
  }

  buildContainer(zip: JSZip) {
    zip.file(
      'META-INF/container.xml',
      dedent`
        <?xml version="1.0"?>
        <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <rootfiles>
            <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
          </rootfiles>
        </container>
      `
    )
  }

  addNav() {
    function renderOl(nav: NavNode[]): string {
      return dedent`
        <ol>
          ${nav
            .map(
              (node) =>
                `<li>${
                  node.href
                    ? `<a href="${node.href}">${node.title}</a>`
                    : node.title
                }${node.nodes.length > 0 ? renderOl(node.nodes) : ''}</li>`
            )
            .join('\n')}
        </ol>
      `
    }

    const navHtml = this.renderXHtml({
      title: this.defaultNavTitle(),
      head: this.importStyle,
      body: dedent`
        <nav epub:type="toc">
          ${renderOl(this.#nav)}
        </nav>
      `,
    })
    this.addManifest('nav.xhtml', navHtml, {
      id: 'nav',
      properties: 'nav',
    })
  }

  buildContentOpf(zip: JSZip) {
    const uuid: string = this.config.uuid ?? uuidv4()
    const date = new Date().toISOString()

    const optionalMeta: string[] = []
    if (this.config.publisher)
      optionalMeta.push(`<dc:publisher>${this.config.publisher}</dc:publisher>`)
    if (this.config.cover)
      optionalMeta.push('<meta name="cover" content="cover"/>')

    zip.file(
      'content.opf',
      dedent`
        <?xml version='1.0' encoding='utf-8'?>
        <package xmlns="http://www.idpf.org/2007/opf" unique-identifier="uuid_id" version="3.0" prefix="epub-builder: https://github.com/weirongxu/epub-builder">
          <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:opf="http://www.idpf.org/2007/opf" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
            <dc:title>${this.config.title}</dc:title>
            <dc:creator>${this.config.author}</dc:creator>
            <dc:identifier>uuid:${uuid}</dc:identifier>
            <dc:identifier id="uuid_id">uuid:${uuid}</dc:identifier>
            <dc:language>${this.config.lang}</dc:language>
            <dc:date>${date}</dc:date>
            ${optionalMeta.join('\n')}
          </metadata>
          <manifest>
            ${this.manifestItems().join('\n')}
          </manifest>
          <spine>
            ${this.spineItems().join('\n')}
          </spine>
        </package>
      `
    )
  }

  buildManifestContent(zip: JSZip) {
    // manifest content
    for (const [path, manifestItem] of this.#manifestItems) {
      if (manifestItem.content) zip.file(path, manifestItem.content)
    }
  }

  build() {
    this.addStyle()
    this.addCover()
    if (this.config.media_folder) this.addMediaFolder(this.config.media_folder)
    this.addSpine(this.config.spine, this.#nav)
    this.addNav()

    const zip = new JSZip()
    zip.file('mimetype', 'application/epub+zip')

    this.buildContainer(zip)
    this.buildContentOpf(zip)
    this.buildManifestContent(zip)
    return zip.generateAsync({ type: 'nodebuffer' })
  }
}

export async function buildBy(
  configPath: string,
  outputPath: string | undefined
) {
  // eslint-disable-next-line no-console
  console.log(`Use config(${configPath})`)
  let config: Config
  if (configPath.endsWith('.json')) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } else if (['.yaml', '.yml'].some((ext) => configPath.endsWith(ext))) {
    config = yaml.parse(fs.readFileSync(configPath, 'utf8'))
  } else {
    console.error('Config type not supported')
    return
  }

  if (!config.author) return console.error('Config required field author')
  if (!config.title) return console.error('Config required field title')
  if (!config.lang) return console.error('Config required field lang')
  if (!config.spine) return console.error('Config required field spine')

  const file = await ContentBuilder.build(config)
  if (!outputPath) {
    outputPath = `${config.title}.epub`
  }
  fs.writeFileSync(outputPath, file)
}
