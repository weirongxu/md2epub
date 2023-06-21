#!/usr/bin/env node

import fs from 'fs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { buildBy } from './build'
import { initBy } from './init'

async function main() {
  await yargs(hideBin(process.argv))
    .command(
      'build',
      'Build a epub book',
      (y) =>
        y
          .option('config', {
            alias: 'c',
            type: 'string',
            desc: 'Config path, default is epub-builder.{yaml,json}',
          })
          .option('output', {
            alias: 'o',
            type: 'string',
            desc: 'Output file path, default {title}.epub',
          }),
      async (argv) => {
        const config = argv.config
        const defaultYamlConfig = 'epub-builder.yaml'
        const defaultJsonConfig = 'epub-builder.json'
        if (config) {
          if (!fs.existsSync(config)) {
            console.error(`Config(${config}) file not found`)
            return
          }
          await buildBy(config, argv.output)
        } else if (fs.existsSync(defaultYamlConfig)) {
          await buildBy(defaultYamlConfig, argv.output)
        } else if (fs.existsSync(defaultJsonConfig)) {
          await buildBy(defaultJsonConfig, argv.output)
        } else {
          console.error('Config file not resolved')
        }
      }
    )
    .command(
      'init',
      'Create a config file',
      (y) => y.option('lang', { alias: 'l', choices: ['en', 'zh'] }),
      async (argv) => {
        await initBy(argv.lang)
      }
    )
    .parse()
}

void main()
