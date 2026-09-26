

$root = "C:\Users\ZIYA\ziya-fos"

$required = @(
    "$root\server\services\authorization.service.ts",
    "$root\server\controllers\organization.controller.ts",
    "$root\server\controllers\settings.controller.ts",
    "$root\server\controllers\platform.controller.ts",
    "$root\server\controllers\invitation.controller.ts",
    "$root\server\controllers\mpesa.controller.ts"
)

foreach ($file in $required) {
    if (-not (Test-Path -LiteralPath $file)) {
        throw "Required file not found: $file"
    }
}

function Add-Import {
    param(
        [string]$Content,
        [string]$Import
    )

    if ($Content -match [regex]::Escape($Import)) {
        return $Content
    }

    return $Import + "`r`n" + $Content
}

function Replace-RegexAll {
    param(
        [string]$Content,
        [string]$Pattern,
        [string]$Replacement,
        [string]$File,
        [int]$Minimum = 1
    )

    $count = ([regex]::Matches($Content, $Pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)).Count

    if ($count -lt $Minimum) {
        throw "Expected at least $Minimum match(es) in ${File}, found $count."
    }

    return @{
        Content = [regex]::Replace(
            $Content,
            $Pattern,
            $Replacement,
            [System.Text.RegularExpressions.RegexOptions]::Multiline
        )
        Count = $count
    }
}

function Write-UpdatedFile {
    param(
        [string]$File,
        [string]$Content
    )

    # Preserve UTF-8 source and avoid changing BOM behavior unnecessarily.
    [System.IO.File]::WriteAllText(
        $File,
        $Content,
        (New-Object System.Text.UTF8Encoding($false))
    )
}

$authImport = 'import { resolveEffectivePermissions } from "../services/authorization.service";'

# ---------------------------------------------------------------------------
# 1. ORGANIZATION CONTROLLER
# ---------------------------------------------------------------------------
$file = "$root\server\controllers\organization.controller.ts"
$content = Get-Content -LiteralPath $file -Raw -Encoding UTF8
$content = Add-Import $content $authImport

$result = Replace-RegexAll `
    -Content $content `
    -Pattern 'permissions:\s*membership\.permissions\s*\?\?\s*\[\],' `
    -Replacement 'permissions: resolveEffectivePermissions(membership.role, membership.permissions),' `
    -File $file `
    -Minimum 3

$content = $result.Content
Write-UpdatedFile $file $content
Write-Host "[UPDATED] $file - $($result.Count) raw membership permission response(s) replaced."

# ---------------------------------------------------------------------------
# 2. SETTINGS CONTROLLER
# ---------------------------------------------------------------------------
$file = "$root\server\controllers\settings.controller.ts"
$content = Get-Content -LiteralPath $file -Raw -Encoding UTF8
$content = Add-Import $content $authImport

$result = Replace-RegexAll `
    -Content $content `
    -Pattern 'permissions:\s*membership\.permissions\s*\?\?\s*\[\],' `
    -Replacement 'permissions: resolveEffectivePermissions(membership.role, membership.permissions),' `
    -File $file `
    -Minimum 1

$content = $result.Content
Write-UpdatedFile $file $content
Write-Host "[UPDATED] $file - $($result.Count) raw membership permission response(s) replaced."

# ---------------------------------------------------------------------------
# 3. PLATFORM CONTROLLER
# ---------------------------------------------------------------------------
$file = "$root\server\controllers\platform.controller.ts"
$content = Get-Content -LiteralPath $file -Raw -Encoding UTF8
$content = Add-Import $content $authImport

$result = Replace-RegexAll `
    -Content $content `
    -Pattern 'permissions:\s*result\.membership\.permissions\s*,' `
    -Replacement 'permissions: resolveEffectivePermissions(result.membership.role, result.membership.permissions),' `
    -File $file `
    -Minimum 1

$content = $result.Content
Write-UpdatedFile $file $content
Write-Host "[UPDATED] $file - $($result.Count) raw membership permission response(s) replaced."

# ---------------------------------------------------------------------------
# 4. INVITATION CONTROLLER
#    - Return effective permissions.
#    - Invitation preview must also use the validated effective permissions.
# ---------------------------------------------------------------------------
$file = "$root\server\controllers\invitation.controller.ts"
$content = Get-Content -LiteralPath $file -Raw -Encoding UTF8
$content = Add-Import $content $authImport

$result1 = Replace-RegexAll `
    -Content $content `
    -Pattern 'permissions:\s*result\.membership\.permissions\s*,' `
    -Replacement 'permissions: resolveEffectivePermissions(result.membership.role, result.membership.permissions),' `
    -File $file `
    -Minimum 1

$content = $result1.Content

$result2 = Replace-RegexAll `
    -Content $content `
    -Pattern 'permissions:\s*result\.membership\.permissions\s*\?\?\s*\[\],' `
    -Replacement 'permissions: resolveEffectivePermissions(result.membership.role, result.membership.permissions),' `
    -File $file `
    -Minimum 2

$content = $result2.Content

# The invitation preview should be based on the server-validated effective
# permissions, not the raw stored invitation array.
$content = $content.Replace(
    'access: invitationAccess(invitation.permissions ?? [])',
    'access: invitationAccess(effectivePermissions)'
)

Write-UpdatedFile $file $content
Write-Host "[UPDATED] $file - invitation responses standardized ($($result1.Count + $result2.Count) response field(s))."

# ---------------------------------------------------------------------------
# 5. M-PESA CONTROLLER
#    Use the same effective permission resolver as the rest of the backend.
# ---------------------------------------------------------------------------
$file = "$root\server\controllers\mpesa.controller.ts"
$content = Get-Content -LiteralPath $file -Raw -Encoding UTF8
$content = Add-Import $content $authImport

$oldMpesa = @'
const userPermissions =
        Array.isArray(
          membership.permissions
        )
          ? membership.permissions
          : [];
'@

$newMpesa = @'
const userPermissions =
        resolveEffectivePermissions(
          membership.role,
          membership.permissions
        );
'@

if ($content.Contains($oldMpesa)) {
    $content = $content.Replace($oldMpesa, $newMpesa)
}
else {
    # Formatting-safe fallback.
    $result = Replace-RegexAll `
        -Content $content `
        -Pattern 'const userPermissions\s*=\s*Array\.isArray\(\s*membership\.permissions\s*\)\s*\?\s*membership\.permissions\s*:\s*\[\];' `
        -Replacement 'const userPermissions = resolveEffectivePermissions(membership.role, membership.permissions);' `
        -File $file `
        -Minimum 1

    $content = $result.Content
}

Write-UpdatedFile $file $content
Write-Host "[UPDATED] $file - M-Pesa authorization now uses effective tenant permissions."

# ---------------------------------------------------------------------------
# 6. FINAL SOURCE CHECKS
# ---------------------------------------------------------------------------
$remaining = @(
    "$root\server\controllers\organization.controller.ts",
    "$root\server\controllers\settings.controller.ts",
    "$root\server\controllers\platform.controller.ts",
    "$root\server\controllers\invitation.controller.ts"
) |
    ForEach-Object {
        Select-String -LiteralPath $_ -Pattern 'membership\.permissions\s*\?\?\s*\[\]|result\.membership\.permissions\s*[,]' -AllMatches
    }

if ($remaining) {
    Write-Host ""
    Write-Warning "Raw permission response references remain:"
    $remaining | ForEach-Object {
        Write-Host "$($_.Path):$($_.LineNumber): $($_.Line.Trim())"
    }
}
else {
    Write-Host ""
    Write-Host "[OK] No raw membership permission responses remain in targeted controllers."
}

Write-Host ""
Write-Host "RBAC backend standardization complete."
Write-Host ""
Write-Host "NEXT:"
Write-Host "  npx tsc --noEmit"
Write-Host "  git diff --check"
Write-Host "  git diff -- server/controllers/organization.controller.ts server/controllers/settings.controller.ts server/controllers/platform.controller.ts server/controllers/invitation.controller.ts server/controllers/mpesa.controller.ts"
