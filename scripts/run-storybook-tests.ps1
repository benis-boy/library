param(
  [int]$Port = 6007,
  [string[]]$ExtraArgs
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$storybookDir = Join-Path $repoRoot 'storybook-static'
$runnerExitCode = 1

function Get-ListeningProcessId([int]$LocalPort) {
  $listener = Get-NetTCPConnection -LocalPort $LocalPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $listener) {
    return $null
  }

  return $listener.OwningProcess
}

npm run build-storybook
if (-not $?) {
  exit 1
}

$existingListener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existingListener) {
  throw "Port $Port is already in use."
}

$stdout = Join-Path $env:TEMP "storybook-test-server-$Port.out.log"
$stderr = Join-Path $env:TEMP "storybook-test-server-$Port.err.log"

$server = Start-Process `
  -FilePath 'cmd.exe' `
  -ArgumentList '/c', "npx http-server storybook-static -p $Port -s" `
  -WorkingDirectory $repoRoot `
  -RedirectStandardOutput $stdout `
  -RedirectStandardError $stderr `
  -PassThru

try {
  $deadline = (Get-Date).AddSeconds(30)
  $listenerPid = $null
  do {
    if ($server.HasExited) {
      throw "Storybook test server exited early. See $stdout and $stderr"
    }

    $listenerPid = Get-ListeningProcessId -LocalPort $Port
    if ($listenerPid) {
      break
    }

    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $deadline)

  if (-not $listenerPid) {
    throw "Storybook test server did not start listening on port $Port. See $stdout and $stderr"
  }

  $runnerArgs = @(
    '@storybook/test-runner',
    '--url', "http://localhost:$Port",
    '--verbose',
    '--maxWorkers', '1',
    '--testTimeout', '30000'
  )

  if ($ExtraArgs) {
    $runnerArgs += $ExtraArgs
  }

  & 'npx' @runnerArgs
  $runnerExitCode = $LASTEXITCODE
}
finally {
  $listenerPid = Get-ListeningProcessId -LocalPort $Port
  if ($listenerPid) {
    Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
    Wait-Process -Id $listenerPid -Timeout 5 -ErrorAction SilentlyContinue
  }

  if ($server -and -not $server.HasExited) {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    Wait-Process -Id $server.Id -Timeout 5 -ErrorAction SilentlyContinue
  }
}

exit $runnerExitCode
