$ErrorActionPreference = 'Stop'

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appRoot = Split-Path -Parent $toolsDir
$repoRoot = Split-Path -Parent $appRoot
$nodeRoot = Join-Path $repoRoot 'tools\\node20\\node-v20.20.1-win-x64'

$nodeExe = Join-Path $nodeRoot 'node.exe'
$npxCli = Join-Path $nodeRoot 'node_modules\\npm\\bin\\npx-cli.js'

if (!(Test-Path $nodeExe)) { throw "node.exe not found: $nodeExe" }
if (!(Test-Path $npxCli)) { throw "npx-cli.js not found: $npxCli" }

$env:NODE_OPTIONS = '--openssl-legacy-provider'
$env:npm_config_cache = Join-Path $repoRoot '.npm-cache20'

& $nodeExe $npxCli @args
