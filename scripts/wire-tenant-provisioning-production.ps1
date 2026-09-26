$ErrorActionPreference = "Stop"

$root = "C:\Users\ZIYA\ziya-fos"

$targets = @(
    "$root\server\controllers\platform.controller.ts",
    "$root\server\controllers\platform.organization.controller.ts",
    "$root\server\controllers\registration.controller.ts"
)

foreach ($file in $targets) {
    if (-not (Test-Path $file)) {
        throw "Missing target file: $file"
    }
}

function Add-ImportIfMissing {
    param(
        [string]$Path
    )

    $content = [System.IO.File]::ReadAllText($Path)

    $import = 'import { ensureTenantBaseline } from "../services/tenantProvisioning.service";'

    if ($content -notmatch [regex]::Escape($import)) {
        $content = $import + "`r`n" + $content
        [System.IO.File]::WriteAllText(
            $Path,
            $content,
            (New-Object System.Text.UTF8Encoding($false))
        )
        Write-Host "[UPDATED] $Path - tenant provisioning import added."
    }
    else {
        Write-Host "[OK] $Path - tenant provisioning import already present."
    }
}

# ------------------------------------------------------------------
# 1. Platform organization creation
# ------------------------------------------------------------------
$path = "$root\server\controllers\platform.organization.controller.ts"
Add-ImportIfMissing $path
$content = [System.IO.File]::ReadAllText($path)

$oldChart = @'
        await tx.account.createMany({
          data: DEFAULT_CHART_OF_ACCOUNTS.map((account) => ({
            ...account,
            organizationId: organization.id,
          })),
        });
'@

$newChart = @'
        // Every newly created tenant receives the same baseline:
        // standard Chart of Accounts + normalized tenant memberships.
        await ensureTenantBaseline(
          tx,
          organization.id
        );
'@

if ($content.Contains($oldChart)) {
    $content = $content.Replace($oldChart, $newChart)
    Write-Host "[UPDATED] $path - direct chart creation replaced with centralized tenant provisioning."
}
elseif ($content -match 'await ensureTenantBaseline\(\s*tx,\s*organization\.id\s*\);') {
    Write-Host "[OK] $path - centralized tenant provisioning already wired."
}
else {
    throw "Could not locate the direct chart initialization block in $path"
}

[System.IO.File]::WriteAllText(
    $path,
    $content,
    (New-Object System.Text.UTF8Encoding($false))
)

# ------------------------------------------------------------------
# 2. Platform organization creation path
# ------------------------------------------------------------------
$path = "$root\server\controllers\platform.controller.ts"
Add-ImportIfMissing $path
$content = [System.IO.File]::ReadAllText($path)

$marker = '/* =====================================================' + "`r`n" + '         CREATE OWNER MEMBERSHIP'

if ($content.Contains($marker)) {
    $needle = '/* =====================================================' + "`r`n" + '         CREATE OWNER MEMBERSHIP'
    $replacement = @'
        // Ensure the new tenant baseline exists before its Owner membership is created.
        await ensureTenantBaseline(
          tx,
          organization.id
        );

        /* =====================================================
         CREATE OWNER MEMBERSHIP
'@
    $content = $content.Replace($needle, $replacement.TrimEnd())
    Write-Host "[UPDATED] $path - tenant provisioning added before Owner membership creation."
}
elseif ($content -match 'await ensureTenantBaseline\(\s*tx,\s*organization\.id\s*\);') {
    Write-Host "[OK] $path - centralized tenant provisioning already wired."
}
else {
    throw "Could not locate CREATE OWNER MEMBERSHIP marker in $path"
}

[System.IO.File]::WriteAllText(
    $path,
    $content,
    (New-Object System.Text.UTF8Encoding($false))
)

# ------------------------------------------------------------------
# 3. Public registration organization creation path
# ------------------------------------------------------------------
$path = "$root\server\controllers\registration.controller.ts"
Add-ImportIfMissing $path
$content = [System.IO.File]::ReadAllText($path)

if ($content -match 'await ensureTenantBaseline\(\s*tx,\s*organization\.id\s*\);') {
    Write-Host "[OK] $path - centralized tenant provisioning already wired."
}
else {
    $pattern = '(?m)(^[ \t]*)(await tx\.organizationMember\.create\(\{)'
    $matches = [regex]::Matches($content, $pattern)

    if ($matches.Count -eq 0) {
        throw "Could not locate OrganizationMember creation in $path"
    }

    # Registration has the organization owner membership creation here.
    $m = $matches[0]
    $indent = $m.Groups[1].Value

    $insertion = @"
${indent}// Ensure the new tenant receives the standard baseline before Owner onboarding.
${indent}await ensureTenantBaseline(
${indent}  tx,
${indent}  organization.id
${indent});

"@

    $content = $content.Insert($m.Index, $insertion)
    Write-Host "[UPDATED] $path - tenant provisioning added before Owner membership creation."
}

[System.IO.File]::WriteAllText(
    $path,
    $content,
    (New-Object System.Text.UTF8Encoding($false))
)

Write-Host ""
Write-Host "Tenant provisioning wiring complete."
Write-Host ""
Write-Host "Run:"
Write-Host "  npx tsc --noEmit"
Write-Host "  git diff --check"
Write-Host "  git diff -- server/controllers/platform.controller.ts server/controllers/platform.organization.controller.ts server/controllers/registration.controller.ts"
