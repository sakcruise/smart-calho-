# Home Box installer for Family Smart Calendar (Windows).
#   In PowerShell:  irm https://smart-calho.vercel.app/home-box/install.ps1 | iex
# Needs Docker Desktop. Installs into %USERPROFILE%\home-box. Safe to run again to update.
$ErrorActionPreference = 'Stop'
$Base = if ($env:HOME_BOX_BASE) { $env:HOME_BOX_BASE } else { 'https://smart-calho.vercel.app/home-box' }
$Dir = if ($env:HOME_BOX_DIR) { $env:HOME_BOX_DIR } else { Join-Path $env:USERPROFILE 'home-box' }

function Say($m) { Write-Host "`n$m" -ForegroundColor Cyan }

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Say "Docker isn't installed yet."
  Write-Host "Install Docker Desktop from https://www.docker.com/products/docker-desktop/ , open it once, then run this again."
  return
}
docker info *> $null
if ($LASTEXITCODE -ne 0) { Say "Docker is installed but not running. Open Docker Desktop, wait until it's running, then run this again."; return }

Say "Downloading the Home Box into $Dir"
foreach ($d in 'config\packages', 'setup', 'data') { New-Item -ItemType Directory -Force -Path (Join-Path $Dir $d) | Out-Null }
function Fetch($p) { Invoke-WebRequest -UseBasicParsing -Uri "$Base/$p" -OutFile (Join-Path $Dir ($p -replace '/', '\')) }
Fetch 'docker-compose.yml'
Fetch 'config/configuration.yaml'
Fetch 'config/packages/family_calendar.yaml'
Fetch 'setup/setup.py'
if (-not (Test-Path (Join-Path $Dir 'config\secrets.yaml'))) { Fetch 'config/secrets.yaml' }

$Code = $env:PAIR_CODE
$secrets = Get-Content (Join-Path $Dir 'config\secrets.yaml') -Raw
if (-not $Code -and $secrets -notmatch 'fam_') {
  Say "Pair with your family"
  $Code = Read-Host "In the Family Calendar app: Parents -> Home Box -> Pair a Home Box. Type the code shown (like ABCD-1234)"
}

Set-Location $Dir
Say "Starting Home Assistant and the voice engines (the first time downloads about 2 GB, so it can take a while)..."
docker compose pull
docker compose up -d homeassistant whisper piper openwakeword
$env:PAIR_CODE = $Code
docker compose run --rm setup

Say "All set!"
try { Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak("Your Home Box is ready") } catch {}
Write-Host "Try it: open http://localhost:8123 , log in with the details below, tap the speech bubble (Assist) and the mic."
$login = Join-Path $Dir 'config\home-box-login.txt'
if (Test-Path $login) { Get-Content $login | Select-Object -Skip 2 -First 2 }
Write-Host "Stop it: cd $Dir; docker compose down     Start again: cd $Dir; docker compose up -d"
