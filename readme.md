# Markdown to EPUB Builder

```shell
npm i -g @raidou/md2epub
```

## Usage

```shell
# Create a configuration file
md2epub init

# Modify configuration file
editor ./md2epub.yaml

# Build
md2epub build
```

## Configuration example

```yaml
author: 'Joan Doe'
title: 'Book Name'
# default_title: '[No Title]'
# cover_title: 'Cover'
# nav_title: 'Navigation'
lang: 'en'
# cover: 'cover.jpeg'
# publisher: 'Book Publisher'
media_folder: 'media'
spine:
  # - cover_page: 'cover.jpeg'
  # - nav_page: true
  - nav.md
  - prelude.md
  - 00.md
  - 01.md
  - path: 01-2.md
    nav: false
  - 02.md
  - 03.md
  - epilogue.md
```

## LICENSE

[MIT](./LICENSE)
