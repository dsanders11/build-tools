#!/usr/bin/env node

const childProcess = require('child_process');
const path = require('path');
const program = require('commander');

const { ElectronVersions, Installer } = require('@electron/fiddle-core');

const evmConfig = require('./evm-config');
const { ensureNodeHeaders } = require('./utils/headers');
const { color, fatal } = require('./utils/logging');

async function runSpecRunner(config, script, runnerArgs, electron_version = undefined) {
  const exec = process.execPath;
  const args = [script, ...runnerArgs];
  const opts = {
    stdio: 'inherit',
    encoding: 'utf8',
    cwd: path.resolve(config.root, 'src', 'electron'),
    env: {
      ELECTRON_OUT_DIR: config.gen.out,
      npm_config_node_gyp: path.resolve(
        __dirname,
        '..',
        'node_modules',
        'node-gyp',
        'bin',
        'node-gyp.js',
      ),
      ...process.env,
      ...config.env,
    },
  };
  if (electron_version) {
    const versions = await ElectronVersions.create();
    const installer = new Installer();
    if (!versions.isVersion(electron_version)) {
      fatal(`${electron_version} is not a supported Electron version`);
    }
    opts.env.ELECTRON_TESTS_EXECUTABLE = await installer.install(electron_version);
  }
  console.log(color.childExec(exec, args, opts));
  childProcess.execFileSync(exec, args, opts);
}

program
  .argument('[specRunnerArgs...]')
  .allowUnknownOption()
  .option('--node', 'Run node spec runner', false)
  .option('--nan', 'Run nan spec runner', false)
  .option(
    '--runners=<main|remote|native>',
    "A subset of tests to run - either 'main', 'remote', or 'native', not used with either the node or nan specs",
  )
  .option('--version <version>', 'Run tests with an Electron release version')
  .action(async (specRunnerArgs, options) => {
    try {
      const config = evmConfig.current();
      if (options.node && options.nan) {
        fatal(
          'Can not run both node and nan specs at the same time, --node and --nan are mutually exclusive',
        );
      }
      let script = './script/spec-runner.js';
      if (options.node) {
        script = './script/node-spec-runner.js';
      }
      if (options.nan) {
        script = './script/nan-spec-runner.js';
      }
      if (!options.version) {
        ensureNodeHeaders(config);
      }
      await runSpecRunner(config, script, specRunnerArgs, options.version);
    } catch (e) {
      fatal(e);
    }
  })
  .parse(process.argv);
