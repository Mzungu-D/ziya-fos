$ErrorActionPreference = "Stop"

$root = "C:\Users\ZIYA\ziya-fos"

$files = @(
    "$root\server\controllers\organization.controller.ts",
    "$root\server\controllers\settings.controller.ts",
    "$root\server\controllers\platform.controller.ts",
    "$root\server\controllers\invitation.controller.ts",
    "$root\server\controllers\mpesa.controller.ts"
)

$sharedImport = 'import { resolveEffectivePermissions } from "../services/authorization.service";'

foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        throw "Required file not found: $file"
    }
}

function Add-SharedAuthorizationImport {
    param([string]$Content)

    if ($Content -notmatch [regex]::Escape($sharedImport)) {
        return $sharedImport + "`r`n" + $Content
    }

    return $Content
}

function Replace-Exact {
    param(
        [string]$Content,
        [string]$Old,
        [string]$New,
        [string]$File
    )

    $count = ([regex]::Matches($Content, [regex]::Escape($Old))).Count

    if ($count -eq 0) {
        throw "Expected pattern was not found in ${File}:`n$Old"
    }

    return $Content.Replace($Old, $New)
}

foreach ($file in $files) {
    $content = Get-Content -Raw -Encoding UTF8 $file
    $content = Add-SharedAuthorizationImport $content

    switch -Wildcard ($file) {
        "*\organization.controller.ts" {
            $content = Replace-Exact $content `
                "permissions:`r`n              membership.permissions ??`r`n              []," `
                "permissions:`r`n              resolveEffectivePermissions(`r`n                membership.role,`r`n                membership.permissions`r`n              )," $file

            $content = Replace-Exact $content `
                "permissions:`r`n          membership.permissions ??`r`n          []," `
                "permissions:`r`n          resolveEffectivePermissions(`r`n            membership.role,`r`n            membership.permissions`r`n          )," $file

            $content = Replace-Exact $content `
                "permissions:`r`n          membership.permissions ??`r`n          []," `
                "permissions:`r`n          resolveEffectivePermissions(`r`n            membership.role,`r`n            membership.permissions`r`n          )," $file
        }

        "*\settings.controller.ts" {
            $content = Replace-Exact $content `
                "permissions:`r`n            membership.permissions ?? []," `
                "permissions:`r`n            resolveEffectivePermissions(`r`n              membership.role,`r`n              membership.permissions`r`n            )," $file
        }

        "*\platform.controller.ts" {
            $content = Replace-Exact $content `
                "permissions:`r`n          result.membership.permissions," `
                "permissions:`r`n          resolveEffectivePermissions(`r`n            result.membership.role,`r`n            result.membership.permissions`r`n          )," $file
        }

        "*\invitation.controller.ts" {
            $content = Replace-Exact $content `
                "permissions:`r`n              result.membership.permissions," `
                "permissions:`r`n              resolveEffectivePermissions(`r`n                result.membership.role,`r`n                result.membership.permissions`r`n              )," $file

            $content = Replace-Exact $content `
                "permissions:`r`n          result.membership.permissions ?? []," `
                "permissions:`r`n          resolveEffectivePermissions(`r`n            result.membership.role,`r`n            result.membership.permissions`r`n          )," $file

            $content = Replace-Exact $content `
                "permissions:`r`n          result.membership.permissions ?? []," `
                "permissions:`r`n          resolveEffectivePermissions(`r`n            result.membership.role,`r`n            result.membership.permissions`r`n          )," $file
        }

        "*\mpesa.controller.ts" {
            $old = @"
      const userPermissions =
        Array.isArray(
          membership.permissions
        )
          ? membership.permissions
          : [];
"@

            $new = @"
      const userPermissions =
        resolveEffectivePermissions(
          membership.role,
          membership.permissions
        );
"@

            $content = Replace-Exact $content $old $new $file
        }
    }

    Set-Content -Path $file -Value $content -Encoding UTF8
    Write-Host "[UPDATED] $file"
}

Write-Host ""
Write-Host "Backend effective-permission standardization complete."
Write-Host ""
Write-Host "Next checks:"
Write-Host "  npx tsc --noEmit"
Write-Host "  git diff --check"
Write-Host ""
Write-Host "IMPORTANT: Frontend visibility is a separate layer."
Write-Host "It must use the SAME effective permissions and every protected API route"
Write-Host "must remain protected by backend requirePermission/requireOwner middleware."

