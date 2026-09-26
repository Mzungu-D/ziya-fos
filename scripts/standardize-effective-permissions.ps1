$ErrorActionPreference = "Stop"

$root = "C:\Users\ZIYA\ziya-fos"

$targets = @(
    "$root\server\controllers\organization.controller.ts",
    "$root\server\controllers\settings.controller.ts"
)

$import = 'import { resolveEffectivePermissions } from "../services/authorization.service";'

foreach ($file in $targets) {
    if (-not (Test-Path $file)) {
        throw "Required file not found: $file"
    }

    $content = Get-Content $file -Raw

    if ($content -notmatch [regex]::Escape($import)) {
        $content = $import + "`r`n" + $content
    }

    $old = 'permissions: membership.permissions ?? [],'
    $new = 'permissions: resolveEffectivePermissions(membership.role, membership.permissions),'

    $count = ([regex]::Matches($content, [regex]::Escape($old))).Count

    if ($count -eq 0) {
        Write-Host "[SKIP] No raw membership permission response found: $file"
        Set-Content -Path $file -Value $content -Encoding UTF8
        continue
    }

    $content = $content.Replace($old, $new)

    Set-Content -Path $file -Value $content -Encoding UTF8

    Write-Host "[UPDATED] $file"
    Write-Host "          Replaced $count raw permission response(s)."
}

Write-Host ""
Write-Host "Effective-permission standardization complete."
Write-Host "Review git diff before committing."
