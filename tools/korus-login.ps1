[CmdletBinding()]
param(
    [string]$Session = 'korus-dev',
    [switch]$Headed
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$artifactRoot = Join-Path $repoRoot 'output\playwright\korus-login'
$envPath = Join-Path $repoRoot '.env'
$allowedOrigin = 'https://knue.korus.ac.kr'
$loginPath = '/poc/uf/LoginCtr/lginView.do'
$landingPath = '/poc/mi/IndxCtr/indx.do'

if ([string]::IsNullOrWhiteSpace($Session)) {
    throw 'Session name must not be empty.'
}

if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
    throw "Missing .env at '$envPath'. Copy .env.example to .env and set KORUS_ID and KORUS_PW."
}

$npxCommand = Get-Command npx.cmd -ErrorAction SilentlyContinue
if ($null -eq $npxCommand) {
    $npxCommand = Get-Command npx -ErrorAction SilentlyContinue
}
if ($null -eq $npxCommand) {
    throw 'npx is required. Install Node.js/npm before running the KORUS browser helper.'
}
$npxPath = if ($npxCommand.Source) { $npxCommand.Source } else { $npxCommand.Path }

function Read-DotEnv {
    param([Parameter(Mandatory)][string]$Path)

    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ($trimmed.Length -eq 0 -or $trimmed.StartsWith('#')) {
            continue
        }

        if ($trimmed -notmatch '^(?:export\s+)?(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?<value>.*)$') {
            continue
        }

        $name = $Matches.name
        $value = $Matches.value.Trim()
        if ($value.Length -ge 2 -and
            (($value.StartsWith('"') -and $value.EndsWith('"')) -or
             ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $values[$name] = $value
    }
    return $values
}

$envValues = Read-DotEnv -Path $envPath
foreach ($requiredKey in @('KORUS_ID', 'KORUS_PW')) {
    if (-not $envValues.ContainsKey($requiredKey) -or
        [string]::IsNullOrWhiteSpace([string]$envValues[$requiredKey])) {
        throw "Missing '$requiredKey' in .env."
    }
}

New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null
Push-Location -LiteralPath $artifactRoot

try {
    function Invoke-PwCli {
        param([Parameter(Mandatory)][string[]]$Arguments)

        $cliArguments = @(
            '--yes',
            '--package',
            '@playwright/cli',
            'playwright-cli',
            '--session',
            $Session
        ) + $Arguments

        $commandOutput = @(& $npxPath @cliArguments 2>&1)
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0) {
            $operation = if ($Arguments.Count -gt 0) { $Arguments[0] } else { 'unknown' }
            throw "Playwright CLI '$operation' failed with exit code $exitCode."
        }
        return $commandOutput
    }

    function Get-PageValue {
        param(
            [Parameter(Mandatory)][ValidateSet('eval', 'run-code')][string]$Command,
            [Parameter(Mandatory)][string]$Expression
        )

        $rawOutput = @(Invoke-PwCli -Arguments @('--raw', $Command, $Expression))
        $rawJson = ($rawOutput | ForEach-Object { [string]$_ }) -join [Environment]::NewLine
        try {
            return ($rawJson.Trim() | ConvertFrom-Json)
        } catch {
            throw "Could not parse Playwright '$Command' result."
        }
    }

    $openArguments = @('open', "$allowedOrigin/")
    if ($Headed) {
        $openArguments += '--headed'
    }
    Invoke-PwCli -Arguments $openArguments | Out-Null

    $currentOrigin = [string](Get-PageValue -Command 'eval' -Expression 'location.origin')
    if ($currentOrigin -ne $allowedOrigin) {
        throw "Unexpected page origin '$currentOrigin'. Expected '$allowedOrigin'."
    }

    $currentPath = [string](Get-PageValue -Command 'eval' -Expression 'location.pathname')
    if ($currentPath -eq $loginPath) {
        $idLocator = "getByRole('textbox', { name: '아이디' })"
        $passwordLocator = "getByRole('textbox', { name: '비밀번호' })"
        $loginLocator = "getByRole('link', { name: '로그인' })"

        # Observed on the KORUS login page; keep credentials out of command output.
        Invoke-PwCli -Arguments @('fill', $idLocator, [string]$envValues.KORUS_ID) | Out-Null
        Invoke-PwCli -Arguments @('fill', $passwordLocator, [string]$envValues.KORUS_PW) | Out-Null
        Invoke-PwCli -Arguments @('click', $loginLocator) | Out-Null

        $currentOrigin = [string](Get-PageValue -Command 'eval' -Expression 'location.origin')
        if ($currentOrigin -ne $allowedOrigin) {
            throw "Unexpected page origin after login '$currentOrigin'. Expected '$allowedOrigin'."
        }
        $currentPath = [string](Get-PageValue -Command 'eval' -Expression 'location.pathname')
    }

    if ($currentPath -ne $landingPath) {
        throw "KORUS login did not reach the expected landing page. Observed path '$currentPath'."
    }

    $hasLandingMarker = [bool](Get-PageValue -Command 'run-code' -Expression "async page => await page.getByRole('link', { name: '로그아웃' }).isVisible()")
    if (-not $hasLandingMarker) {
        throw 'KORUS landing-page marker was not visible.'
    }

    Write-Host 'KORUS login: PASS'
    Write-Host "Landing path: $currentPath"
    Write-Host "Playwright session remains open: $Session"
} finally {
    Pop-Location
}
