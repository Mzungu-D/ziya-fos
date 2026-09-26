$ErrorActionPreference = "Stop"

$root = "C:\Users\ZIYA\ziya-fos"

function Add-ImportIfMissing {
    param(
        [string]$Path,
        [string]$ImportLine
    )

    $content = Get-Content -Raw -LiteralPath $Path

    if ($content -notmatch [regex]::Escape($ImportLine)) {
        $content = $ImportLine + "`r`n" + $content
        Set-Content -LiteralPath $Path -Value $content -NoNewline
        Write-Host "[UPDATED] $Path - tenant provisioning import added."
    }
    else {
        Write-Host "[OK] $Path - tenant provisioning import already present."
    }
}

function Replace-Once {
    param(
        [string]$Path,
        [string]$Pattern,
        [string]$Replacement,
        [string]$Description
    )

    $content = Get-Content -Raw -LiteralPath $Path

    if ($content -match [regex]::Escape($Replacement.Trim())) {
        Write-Host "[OK] $Path - $Description already present."
        return
    }

    if (-not $content.Contains($Pattern)) {
        throw "Could not locate the exact insertion point for $Description in $Path"
    }

    $updated = $content.Replace($Pattern, $Replacement)

    if ($updated -eq $content) {
        throw "No change was made while applying $Description to $Path"
    }

    Set-Content -LiteralPath $Path -Value $updated -NoNewline
    Write-Host "[UPDATED] $Path - $Description"
}

$platform = Join-Path $root "server\controllers\platform.controller.ts"
$registration = Join-Path $root "server\controllers\registration.controller.ts"

if (-not (Test-Path -LiteralPath $platform)) {
    throw "File not found: $platform"
}

if (-not (Test-Path -LiteralPath $registration)) {
    throw "File not found: $registration"
}

$provisionImport = 'import { ensureTenantBaseline } from "../services/tenantProvisioning.service";'

# ------------------------------------------------------------
# PLATFORM ADMIN CREATION PATH
# ------------------------------------------------------------
Add-ImportIfMissing -Path $platform -ImportLine $provisionImport

$platformMarker = @'
          /* ===============================================
             CREATE OWNER MEMBERSHIP
          =============================================== */

          const membership =
'@

$platformReplacement = @'
          /* ===============================================
             INITIALIZE TENANT BASELINE
          =============================================== */

          await ensureTenantBaseline(
            tx,
            organization.id
          );

          /* ===============================================
             CREATE OWNER MEMBERSHIP
          =============================================== */

          const membership =
'@

Replace-Once `
    -Path $platform `
    -Pattern $platformMarker `
    -Replacement $platformReplacement `
    -Description "tenant baseline provisioning before OWNER membership creation"

# ------------------------------------------------------------
# TENANT SELF-REGISTRATION PATH
# ------------------------------------------------------------
Add-ImportIfMissing -Path $registration -ImportLine $provisionImport

$registrationMarker = @'
        await tx.organizationMember.create({
'@

$registrationReplacement = @'
        await ensureTenantBaseline(
          tx,
          organization.id
        );

        await tx.organizationMember.create({
'@

Replace-Once `
    -Path $registration `
    -Pattern $registrationMarker `
    -Replacement $registrationReplacement `
    -Description "tenant baseline provisioning before self-registration OWNER membership creation"

Write-Host ""
Write-Host "Tenant provisioning wiring complete."
Write-Host ""
Write-Host "Verify:"
Write-Host "  Select-String -Path server/controllers/platform.controller.ts,server/controllers/platform.organization.controller.ts,server/controllers/registration.controller.ts -Pattern 'ensureTenantBaseline'"
Write-Host ""
Write-Host "Then run:"
Write-Host "  npx tsc --noEmit"
Write-Host "  git diff --check"
Write-Host "  git diff -- server/controllers/platform.controller.ts server/controllers/platform.organization.controller.ts server/controllers/registration.controller.ts"
