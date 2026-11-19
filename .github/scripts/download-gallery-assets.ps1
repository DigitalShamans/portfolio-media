# Windows PowerShell 5.1. Downloads reviewed, stable ArtStation JPG/MP4 URLs only.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$InputFile,
    [Parameter(Mandatory = $true)][string]$OutputDir,
    [Parameter(Mandatory = $true)][string]$ReportPath,
    [ValidateRange(1, 4)][int]$Concurrency = 4
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http

function Get-Field($Object, [string]$Name) {
    if ($null -ne $Object -and $null -ne $Object.PSObject.Properties[$Name]) { return ,($Object.$Name) }
    return $null
}

function Get-TextHash([string]$Text) {
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($algorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($Text)))).Replace('-', '').ToLowerInvariant() }
    finally { $algorithm.Dispose() }
}

function Assert-SourceUrl([string]$Value, [string]$Kind) {
    $uri = $null
    if ($Value -match '[\x00-\x20\x7f%\\]' -or -not [Uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$uri) -or
        $uri.Scheme -ne 'https' -or $uri.UserInfo -or $uri.Fragment -or $uri.Port -ne 443 -or
        @('cdn.artstation.com', 'cdna.artstation.com', 'cdnb.artstation.com') -notcontains $uri.DnsSafeHost.ToLowerInvariant()) {
        throw 'Expected an unsigned HTTPS ArtStation CDN URL without credentials, encoding, fragment or custom port.'
    }
    $path = $uri.AbsolutePath
    $prefix = if ($Kind -eq 'image') { '/p/assets/images/' } else { '/p/video_sources/' }
    $extension = if ($Kind -eq 'image') { '\.jpg$' } else { '\.mp4$' }
    if (-not $path.StartsWith($prefix, [StringComparison]::Ordinal) -or $path -notmatch '^[A-Za-z0-9/_.-]+$' -or
        $path -notmatch $extension -or $Value -match '/\.\.?(/|\?|$)') {
        throw 'Unsupported ArtStation source path or media extension.'
    }
    if ($uri.Query) {
        $numeric = 0; $download = 0
        foreach ($part in $uri.Query.Substring(1).Split('&')) {
            if ($part -cmatch '^[0-9]{1,20}$') { $numeric++ }
            elseif ($part -ceq 'dl=1') { $download++ }
            else { throw 'Only a numeric cache timestamp and dl=1 are allowed in source queries; signed/temporary URLs are unsupported.' }
        }
        if ($numeric -gt 1 -or $download -gt 1) { throw 'Duplicate source query components are unsupported.' }
    }
    return $uri.AbsoluteUri
}

function Assert-FileFacts($Item, [string]$Path, $Prior) {
    $file = Get-Item -LiteralPath $Path
    if ($file.PSIsContainer -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Unsafe existing original: $($Item.filename)" }
    $bytes = $file.Length
    $hash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($bytes -le 0 -or ($null -ne $Item.expected_bytes -and $bytes -ne $Item.expected_bytes) -or
        ($Item.expected_sha256 -and $hash -cne $Item.expected_sha256)) { throw "Expected bytes/hash mismatch: $($Item.filename)" }
    if ($null -ne $Prior -and ($bytes -ne $Prior.bytes -or $hash -cne $Prior.sha256)) { throw "Existing original does not match its successful report: $($Item.filename)" }
    return @{ bytes = $bytes; sha256 = $hash }
}

function Save-Report {
    $report.updated_at_utc = [DateTime]::UtcNow.ToString('o')
    $report.elapsed_seconds = [Math]::Round($totalClock.Elapsed.TotalSeconds, 3)
    $reportParent = [IO.Path]::GetDirectoryName($reportFile)
    [IO.Directory]::CreateDirectory($reportParent) | Out-Null
    $temporary = Join-Path $reportParent ('.gallery-report-' + [Guid]::NewGuid().ToString('N') + '.tmp')
    try {
        [IO.File]::WriteAllText($temporary, ($report | ConvertTo-Json -Depth 10), [Text.UTF8Encoding]::new($false))
        if ([IO.File]::Exists($reportFile)) {
            # Windows scanners/readers can briefly hold the previous JSON file open.
            for ($attempt = 0; ; $attempt++) {
                try { [IO.File]::Replace($temporary, $reportFile, [NullString]::Value); break }
                catch [IO.IOException] { if ($attempt -ge 4) { throw }; Start-Sleep -Milliseconds 100 }
            }
        } else { [IO.File]::Move($temporary, $reportFile) }
    } finally { if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) } }
}

$inputPath = [IO.Path]::GetFullPath($InputFile)
$destination = [IO.Path]::GetFullPath($OutputDir).TrimEnd([IO.Path]::DirectorySeparatorChar)
$reportFile = [IO.Path]::GetFullPath($ReportPath)
if ($inputPath -eq $reportFile) { throw 'ReportPath must not replace InputFile.' }
if (Test-Path -LiteralPath $destination) {
    $directory = Get-Item -LiteralPath $destination
    if (-not $directory.PSIsContainer -or ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'OutputDir must be an ordinary directory.' }
}
if ((Test-Path -LiteralPath $reportFile) -and ((Get-Item -LiteralPath $reportFile).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'ReportPath must not be a reparse point.' }
$payload = Get-Content -LiteralPath $inputPath -Raw -Encoding UTF8 | ConvertFrom-Json
$source = $null
foreach ($field in @('media', 'entries', 'assets')) {
    if ($null -ne (Get-Field $payload $field)) { $source = Get-Field $payload $field; break }
}
if ($null -eq $source -or $source -isnot [Array]) { throw 'Input requires a media, entries or assets JSON array.' }
$items = [Collections.Generic.List[object]]::new()
$names = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$ignored = 0
foreach ($entry in $source) {
    $kind = ([string](Get-Field $entry 'type')).ToLowerInvariant()
    if ($null -eq $entry -or $kind -in @('youtube', 'yt', 'sketchfab', 'sf', 'embed', 'empty')) { $ignored++; continue }
    if (-not $kind -and -not (Get-Field $entry 'filename') -and -not (Get-Field $entry 'source_url') -and
        -not (Get-Field $entry 'downloaded_url') -and -not (Get-Field $entry 'url')) { $ignored++; continue }
    if ($kind -notin @('image', 'video')) { throw 'Only image/video media and known embed/empty entries are supported.' }
    $name = [string](Get-Field $entry 'filename')
    $extension = if ($kind -eq 'image') { '\.jpg$' } else { '\.mp4$' }
    if ($name.Length -gt 200 -or $name -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*\.(jpg|mp4)$' -or $name -notmatch $extension -or
        $name.Split('.')[0] -match '^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$') { throw 'Unsafe filename, Windows reserved name or type/extension mismatch.' }
    if (-not $names.Add($name)) { throw "Duplicate/case-colliding filename: $name" }
    $url = $null
    foreach ($field in @('source_url', 'downloaded_url', 'url')) { if (Get-Field $entry $field) { $url = [string](Get-Field $entry $field); break } }
    $url = Assert-SourceUrl $url $kind
    $expectedBytes = $null; $expectedHash = $null
    foreach ($field in @('expected_bytes', 'bytes', 'size')) {
        $value = Get-Field $entry $field
        if ($null -ne $value) {
            $parsed = 0L
            if (-not [long]::TryParse([string]$value, [ref]$parsed) -or $parsed -le 0 -or
                ($null -ne $expectedBytes -and $expectedBytes -ne $parsed)) { throw "Invalid/conflicting expected byte size: $name" }
            $expectedBytes = $parsed
        }
    }
    foreach ($field in @('expected_sha256', 'sha256')) {
        $value = Get-Field $entry $field
        if ($null -ne $value) {
            if ([string]$value -notmatch '^[a-fA-F0-9]{64}$' -or ($expectedHash -and $expectedHash -ne ([string]$value).ToLowerInvariant())) { throw "Invalid/conflicting expected SHA-256: $name" }
            $expectedHash = ([string]$value).ToLowerInvariant()
        }
    }
    $target = Join-Path $destination $name
    if ($target -eq $reportFile -or $target -eq $inputPath) { throw 'An original path conflicts with the input/report path.' }
    $items.Add([pscustomobject]@{ filename = $name; type = $kind; source_url = $url; key = (Get-TextHash ($url + "`n" + $name)); path = $target; expected_bytes = $expectedBytes; expected_sha256 = $expectedHash })
}

$priorFiles = $null
if (Test-Path -LiteralPath $reportFile) {
    $priorReport = Get-Content -LiteralPath $reportFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($priorReport.schema_version -ne 1 -or $priorReport.output_dir -ne $destination -or -not $priorReport.files) { throw 'Existing report does not describe this originals directory.' }
    $priorFiles = $priorReport.files
}
$totalClock = [Diagnostics.Stopwatch]::StartNew()
$report = [ordered]@{ schema_version = 1; input_file = $inputPath; output_dir = $destination; started_at_utc = [DateTime]::UtcNow.ToString('o'); updated_at_utc = $null; elapsed_seconds = 0; concurrency = $Concurrency; ignored_entries = $ignored; files = [ordered]@{} }
$pending = [Collections.Generic.Queue[object]]::new()
# Validate every existing original before starting any transfer or replacing the report.
foreach ($item in $items) {
    $record = [ordered]@{ filename = $item.filename; type = $item.type; source_url = $item.source_url; final_url = $null; status = 'pending'; success = $false; http_status = $null; bytes = $null; sha256 = $null; attempts = 0; elapsed_seconds = 0; error = $null }
    if (Test-Path -LiteralPath $item.path) {
        $prior = Get-Field $priorFiles $item.key
        if ($null -eq $prior -or $prior.success -ne $true -or $prior.status -notin @('downloaded', 'cached') -or
            $prior.filename -cne $item.filename -or $prior.source_url -cne $item.source_url -or
            $prior.sha256 -cnotmatch '^[a-f0-9]{64}$' -or $prior.bytes -le 0) { throw "Existing original lacks a matching successful URL/filename report: $($item.filename)" }
        $facts = Assert-FileFacts $item $item.path $prior
        $record.status = 'cached'; $record.success = $true; $record.bytes = $facts.bytes; $record.sha256 = $facts.sha256
        $record.final_url = $prior.final_url
    } else { $pending.Enqueue($item) }
    $report.files[$item.key] = $record
}
[IO.Directory]::CreateDirectory($destination) | Out-Null
Save-Report
$handler = [Net.Http.HttpClientHandler]::new()
$handler.AllowAutoRedirect = $false
$client = [Net.Http.HttpClient]::new($handler)
$client.Timeout = [Threading.Timeout]::InfiniteTimeSpan
$client.DefaultRequestHeaders.Add('User-Agent', 'Gallery-original-acquisition/1.0')
$active = [Collections.Generic.List[object]]::new()

function Start-Request($Job) {
    if ($null -eq $Job.cancellation) { $Job.cancellation = [Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds(90)) }
    $Job.phase = 'headers'
    $Job.task = $client.GetAsync([Uri]$Job.url, [Net.Http.HttpCompletionOption]::ResponseHeadersRead, $Job.cancellation.Token)
}
function Close-Transfer($Job) {
    if ($Job.stream) { $Job.stream.Dispose(); $Job.stream = $null }
    if ($Job.response) { $Job.response.Dispose(); $Job.response = $null }
    if ($Job.cancellation) { $Job.cancellation.Dispose(); $Job.cancellation = $null }
    if ($Job.temporary -and [IO.File]::Exists($Job.temporary)) { [IO.File]::Delete($Job.temporary) }
}
try {
    while ($pending.Count -or $active.Count) {
        while ($pending.Count -and $active.Count -lt $Concurrency) {
            $item = $pending.Dequeue()
            $job = [pscustomobject]@{ item = $item; record = $report.files[$item.key]; clock = [Diagnostics.Stopwatch]::StartNew(); phase = ''; task = $null; url = $item.source_url; redirects = 0; response = $null; stream = $null; cancellation = $null; temporary = $null; retry_at = [DateTime]::MinValue }
            $job.record.attempts = 1
            $active.Add($job)
            Start-Request $job
        }
        foreach ($job in @($active.ToArray())) {
            try {
                if ($job.phase -eq 'retry') {
                    if ([DateTime]::UtcNow -lt $job.retry_at) { continue }
                    $job.url = $job.item.source_url; $job.redirects = 0
                    Start-Request $job
                }
                if (-not $job.task.IsCompleted) { continue }
                if ($job.phase -eq 'headers') {
                    $job.response = $job.task.GetAwaiter().GetResult()
                    $status = [int]$job.response.StatusCode
                    $job.record.http_status = $status
                    if ($status -in @(301, 302, 303, 307, 308)) {
                        if (++$job.redirects -gt 3 -or -not $job.response.Headers.Location) { throw 'Missing or excessive redirects.' }
                        $location = [Uri]::new([Uri]$job.url, $job.response.Headers.Location)
                        $job.url = Assert-SourceUrl $location.AbsoluteUri $job.item.type
                        $job.response.Dispose(); $job.response = $null
                        Start-Request $job
                        continue
                    }
                    if ($status -in @(429, 500, 502, 503, 504) -and $job.record.attempts -lt 3) {
                        Close-Transfer $job
                        $job.retry_at = [DateTime]::UtcNow.AddSeconds([Math]::Pow(2, $job.record.attempts - 1))
                        $job.record.attempts++; $job.phase = 'retry'
                        continue
                    }
                    if ($status -ne 200) { throw "HTTP $status; original not saved (403 and other permanent failures are not retried)." }
                    $job.temporary = Join-Path $destination ('.gallery-download-' + [Guid]::NewGuid().ToString('N') + '.tmp')
                    $job.stream = [IO.FileStream]::new($job.temporary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None, 81920, $true)
                    $body = $job.response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
                    $job.task = $body.CopyToAsync($job.stream, 81920, $job.cancellation.Token)
                    $job.phase = 'body'
                }
                if ($job.phase -eq 'body' -and $job.task.IsCompleted) {
                    $job.task.GetAwaiter().GetResult() | Out-Null
                    $job.stream.Dispose(); $job.stream = $null
                    $facts = Assert-FileFacts $job.item $job.temporary $null
                    $length = $job.response.Content.Headers.ContentLength
                    if ($null -ne $length -and $facts.bytes -ne $length) { throw 'Content-Length does not match downloaded bytes.' }
                    # File.Move never replaces an existing original, including a concurrent writer.
                    [IO.File]::Move($job.temporary, $job.item.path)
                    $job.record.status = 'downloaded'; $job.record.success = $true
                    $job.record.bytes = $facts.bytes; $job.record.sha256 = $facts.sha256; $job.record.final_url = $job.url
                    $job.record.elapsed_seconds = [Math]::Round($job.clock.Elapsed.TotalSeconds, 3)
                    Close-Transfer $job
                    $active.Remove($job) | Out-Null
                    Save-Report
                }
            } catch {
                $job.record.status = 'failed'; $job.record.error = $_.Exception.GetBaseException().Message
                $job.record.elapsed_seconds = [Math]::Round($job.clock.Elapsed.TotalSeconds, 3)
                Close-Transfer $job
                $active.Remove($job) | Out-Null
                Save-Report
            }
        }
        if ($active.Count) { Start-Sleep -Milliseconds 40 }
    }
} finally {
    foreach ($job in $active) { if ($job.cancellation) { $job.cancellation.Cancel() }; Close-Transfer $job }
    $client.Dispose(); $handler.Dispose()
}
Save-Report
$records = @($report.files.Values)
$failed = @($records | Where-Object { -not $_.success }).Count
[pscustomobject]@{ files = $records.Count; downloaded = @($records | Where-Object status -eq 'downloaded').Count; cached = @($records | Where-Object status -eq 'cached').Count; failed = $failed; elapsed_seconds = $report.elapsed_seconds; report = $reportFile } | ConvertTo-Json -Compress
if ($failed) { throw "$failed original(s) failed; inspect the report. Existing originals were not overwritten." }
