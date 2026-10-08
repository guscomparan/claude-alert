# Install claude-alert into a target project (project/folder level only).
# For Windows (PowerShell).
#
# Usage (from inside this repo):
#   .\install.ps1                       # install into the current directory
#   .\install.ps1 C:\path\to\project    # install into another project
#
# Copies the alert script into <target>\.claude\ and adds the "Stop" and
# "PreToolUse" (AskUserQuestion) hooks to <target>\.claude\settings.json
# (merging if one already exists).

param(
  [string]$Target = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'

$SrcDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$Target   = (Resolve-Path $Target).Path
$ClaudeDir = Join-Path $Target '.claude'
New-Item -ItemType Directory -Force -Path $ClaudeDir | Out-Null

Copy-Item (Join-Path $SrcDir '.claude\claude-alert.js') (Join-Path $ClaudeDir 'claude-alert.js') -Force

$Settings = Join-Path $ClaudeDir 'settings.json'
$NewJson  = Get-Content (Join-Path $SrcDir '.claude\settings.json') -Raw | ConvertFrom-Json

if (Test-Path $Settings) {
  $existing = Get-Content $Settings -Raw | ConvertFrom-Json
  if (-not $existing.hooks)      { $existing | Add-Member -NotePropertyName hooks -NotePropertyValue (@{}) -Force }
  foreach ($event in $NewJson.hooks.PSObject.Properties.Name) {
    $merged = @()
    if ($existing.hooks.$event) { $merged += $existing.hooks.$event }
    $merged += $NewJson.hooks.$event
    $existing.hooks | Add-Member -NotePropertyName $event -NotePropertyValue $merged -Force
  }
  $existing | ConvertTo-Json -Depth 20 | Set-Content $Settings -Encoding UTF8
  Write-Host "OK Merged hooks into existing $Settings"
} else {
  Copy-Item (Join-Path $SrcDir '.claude\settings.json') $Settings -Force
  Write-Host "OK Installed $Settings"
}

Write-Host "OK Installed $(Join-Path $ClaudeDir 'claude-alert.js')"
Write-Host ""
Write-Host "Done. Restart Claude Code in $Target (or run /hooks) to load it."
