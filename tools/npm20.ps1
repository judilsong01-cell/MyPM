$ErrorActionPreference = 'Stop'

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appRoot = Split-Path -Parent $toolsDir
$repoRoot = Split-Path -Parent $appRoot
$nodeRoot = Join-Path $repoRoot 'tools\\node20\\node-v20.20.1-win-x64'

$nodeExe = Join-Path $nodeRoot 'node.exe'
$npmCli = Join-Path $nodeRoot 'node_modules\\npm\\bin\\npm-cli.js'

if (!(Test-Path $nodeExe)) { throw "node.exe not found: $nodeExe" }
if (!(Test-Path $npmCli)) { throw "npm-cli.js not found: $npmCli" }

# Workaround for npm SSL cipher issues in this environment.
$env:NODE_OPTIONS = '--openssl-legacy-provider'
$env:npm_config_cache = Join-Path $repoRoot '.npm-cache20'

& $nodeExe $npmCli @args
