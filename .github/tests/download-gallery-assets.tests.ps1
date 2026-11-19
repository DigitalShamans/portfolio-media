# Offline safety/resume checks. Run with Windows PowerShell 5.1 or PowerShell 7.
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot '../scripts/download-gallery-assets.ps1'
$scratch = Join-Path ([IO.Path]::GetTempPath()) ('gallery-downloader-test-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($scratch) | Out-Null
$checks = 0
function Assert($Condition, [string]$Message) { if (-not $Condition) { throw $Message }; $script:checks++ }
function Hash-Text([string]$Value) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}
function Write-Input($Entries, [string]$ArrayName = 'media') {
    $payload = @{}; $payload[$ArrayName] = @($Entries)
    [IO.File]::WriteAllText($inputPath, ($payload | ConvertTo-Json -Depth 6))
}
function Expect-Failure([string]$Pattern) {
    $failed = $false
    try { & $script -InputFile $inputPath -OutputDir $originals -ReportPath $reportPath | Out-Null }
    catch { $failed = $true; Assert ($_.Exception.Message -match $Pattern) "Unexpected failure: $($_.Exception.Message)" }
    Assert $failed "Expected failure matching $Pattern"
    Assert ((Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash -eq $script:currentHash) 'A failed preflight changed an original.'
}
try {
    $inputPath = Join-Path $scratch 'input.json'
    $originals = Join-Path $scratch 'originals'
    $reportPath = Join-Path $scratch 'report.json'
    [IO.Directory]::CreateDirectory($originals) | Out-Null
    $name = 'Lead.jpg'
    $url = 'https://cdnb.artstation.com/p/assets/images/images/001/002/003/4k/Lead.jpg?123456&dl=1'
    $original = Join-Path $originals $name
    [IO.File]::WriteAllBytes($original, [byte[]](1, 2, 3, 4))
    $currentHash = (Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash
    $key = Hash-Text ($url + "`n" + $name)
    $files = @{}; $files[$key] = @{ filename = $name; source_url = $url; final_url = $url; success = $true; status = 'downloaded'; bytes = 4; sha256 = $currentHash.ToLowerInvariant() }
    @{ schema_version = 1; output_dir = $originals; files = $files } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $reportPath -Encoding UTF8
    $valid = @{ type = 'image'; filename = $name; source_url = $url; expected_bytes = 4; sha256 = $currentHash }
    foreach ($arrayName in @('media', 'entries', 'assets')) {
        Write-Input @($valid, @{type = 'youtube'}, @{type = 'sf'}, @{type = 'embed'}, @{type = 'empty'}, $null) $arrayName
        & $script -InputFile $inputPath -OutputDir $originals -ReportPath $reportPath | Out-Null
        $result = Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
        Assert ($result.files.$key.status -eq 'cached' -and $result.files.$key.attempts -eq 0) 'Verified originals should resume without a transfer.'
        Assert ($result.ignored_entries -eq 5) 'Known embeds/empty entries should be ignored.'
    }
    foreach ($badUrl in @(
        $url.Replace('https:', 'http:'), $url.Replace('cdnb.artstation.com', 'localhost'),
        $url.Replace('cdnb.artstation.com', 'cdnb.artstation.com.example.com'),
        $url.Replace('https://', 'https://user:password@'), $url.Replace('.com/', '.com:444/'),
        $url.Replace('/p/assets/images/', '/private/'), ($url + '&expires=999'), ($url + '&sig=secret'),
        ($url + '#fragment'), $url.Replace('/4k/', '/%2e%2e/'), $url.Replace('?123456&dl=1', '?dl=2')
    )) {
        Write-Input @(@{ type = 'image'; filename = $name; source_url = $badUrl })
        Expect-Failure 'HTTPS ArtStation|source path|source quer'
    }
    foreach ($badName in @('../Lead.jpg', 'CON.extra.jpg', 'LPT1.jpg', 'Trailing .jpg', 'wrong.mp4')) {
        Write-Input @(@{ type = 'image'; filename = $badName; source_url = $url })
        Expect-Failure 'Unsafe filename'
    }
    Write-Input @($valid, @{type = 'image'; filename = 'lead.JPG'; source_url = $url})
    Expect-Failure 'case-colliding'
    Write-Input @(@{type = 'video'; filename = 'Clip.mp4'; source_url = $url})
    Expect-Failure 'source path'
    Write-Input @(@{type = 'image'; filename = $name; url = $url; bytes = 5})
    Expect-Failure 'Expected bytes/hash mismatch'
    Write-Input @(@{type = 'image'; filename = $name; downloaded_url = $url; sha256 = ('0' * 64)})
    Expect-Failure 'Expected bytes/hash mismatch'
    Write-Input @(@{type = 'image'; filename = $name; source_url = $url.Replace('?123456&dl=1', '?123457')})
    Expect-Failure 'lacks a matching successful'
    # Same length corruption must fail the stored hash, even without input expectations.
    [IO.File]::WriteAllBytes($original, [byte[]](4, 3, 2, 1))
    $currentHash = (Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash
    Write-Input @(@{type = 'image'; filename = $name; source_url = $url})
    Expect-Failure 'does not match its successful report'
    [IO.File]::Delete($reportPath)
    Expect-Failure 'lacks a matching successful'
    Write-Output "PASS: $checks offline downloader checks; no downloads required."
} finally {
    # Only this test's freshly created, GUID-named scratch directory is removed.
    $resolved = [IO.Path]::GetFullPath($scratch)
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if ($resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolved) -match '^gallery-downloader-test-[a-f0-9]{32}$') { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
