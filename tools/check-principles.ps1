[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$failures = [System.Collections.Generic.List[string]]::new()
$allowedOrigin = 'https://knue.korus.ac.kr/*'

function Add-Failure([string]$Message, [string]$Fix) {
    $failures.Add("ERROR: $Message`n  FIX: $Fix`n  REF: AGENTS.md -> Golden Principles")
}

$manifestFiles = Get-ChildItem -LiteralPath $repoRoot -Recurse -File -Filter 'manifest*.json' |
    Where-Object { $_.FullName -notmatch '[\\/](node_modules|dist|build|\.git)[\\/]' }

foreach ($manifestFile in $manifestFiles) {
    try {
        $manifest = Get-Content -Raw -LiteralPath $manifestFile.FullName | ConvertFrom-Json
    } catch {
        Add-Failure "$($manifestFile.FullName) is not valid JSON." 'Fix JSON syntax before continuing.'
        continue
    }

    $patterns = @()
    if ($manifest.PSObject.Properties.Name -contains 'host_permissions') {
        $patterns += @($manifest.host_permissions)
    }
    if ($manifest.PSObject.Properties.Name -contains 'optional_host_permissions') {
        $patterns += @($manifest.optional_host_permissions)
    }
    if ($manifest.PSObject.Properties.Name -contains 'content_scripts') {
        foreach ($script in @($manifest.content_scripts)) { $patterns += @($script.matches) }
    }

    foreach ($pattern in $patterns | Where-Object { $_ }) {
        if ([string]$pattern -ne $allowedOrigin) {
            Add-Failure "$($manifestFile.Name) requests host pattern '$pattern'." "Use only '$allowedOrigin', or obtain explicit approval and update the principle plus checker together."
        }
    }

    $broadPermissions = @('cookies', 'debugger', 'history', 'management', 'nativeMessaging', 'proxy', 'webRequest', 'webRequestBlocking')
    foreach ($permission in @($manifest.permissions) + @($manifest.optional_permissions)) {
        if ($broadPermissions -contains [string]$permission) {
            Add-Failure "$($manifestFile.Name) requests broad permission '$permission'." 'Remove it or document an exercised code path and obtain explicit approval before changing this allow policy.'
        }
    }
}

$scanRoots = @('src', 'test', 'tests', 'fixtures') | ForEach-Object { Join-Path $repoRoot $_ } | Where-Object { Test-Path -LiteralPath $_ }
$sensitivePatterns = @(
    '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----',
    '\bAKIA[0-9A-Z]{16}\b',
    '(?i)\b(authorization|cookie|password|session[_-]?id|access[_-]?token)\b\s*[:=]\s*["''][^"'']{8,}["'']',
    '(?i)console\.(log|debug|info)\([^\r\n]*(authorization|cookie|password|session|token)'
)

foreach ($scanRoot in $scanRoots) {
    Get-ChildItem -LiteralPath $scanRoot -Recurse -File |
        Where-Object { $_.Extension -match '^\.(js|jsx|ts|tsx|json|html|css|md)$' } |
        ForEach-Object {
            $content = Get-Content -Raw -LiteralPath $_.FullName
            foreach ($pattern in $sensitivePatterns) {
                if ($content -match $pattern) {
                    Add-Failure "$($_.FullName) contains material matching a sensitive-data pattern." 'Replace with a clearly synthetic placeholder and ensure runtime logs/storage exclude KORUS secrets and data.'
                    break
                }
            }
        }
}

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Output "principles: PASS (origin=$allowedOrigin; manifests=$($manifestFiles.Count))"
