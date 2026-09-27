# manifest(탭 구분: name, size, ref, mode) 목록을 최대 $Parallel개씩 동시에 생성한다.
# 사용: powershell -File tools\genqueue.ps1 -Manifest tools\manifest.tsv [-Parallel 3] [-SkipExisting] [-Only pt_sassi_calm,sc_tavern]
# 프롬프트는 tools\prompts\<name>.txt, 결과는 assets\raw\<name>.png
param([string]$Manifest, [int]$Parallel = 3, [switch]$SkipExisting, [string]$Only = "")
$root = Split-Path $PSScriptRoot
$onlyList = @($Only.Split(",") | Where-Object { $_ -ne "" })
$lines = Get-Content -LiteralPath $Manifest -Encoding UTF8 | Where-Object { $_.Trim() -ne "" -and -not $_.StartsWith("#") }
$queue = New-Object System.Collections.Queue
foreach ($l in $lines) {
  if ($onlyList.Count -gt 0 -and -not ($onlyList -contains $l.Split("`t")[0])) { continue }
  $queue.Enqueue($l)
}
$running = @()
while ($queue.Count -gt 0 -or $running.Count -gt 0) {
  while ($running.Count -lt $Parallel -and $queue.Count -gt 0) {
    $p = $queue.Dequeue().Split("`t")
    $name = $p[0]; $size = $p[1]
    $ref = if ($p.Count -gt 2) { $p[2] } else { "" }
    $mode = if ($p.Count -gt 3 -and $p[3] -ne "") { $p[3] } else { "same" }
    $out = Join-Path $root "assets\raw\$name.png"
    if ($SkipExisting -and (Test-Path $out)) { "SKIP $name"; continue }
    $refPath = if ($ref -ne "") { Join-Path $root $ref } else { "" }
    $running += Start-Job -Name $name -ScriptBlock {
      param($root, $name, $size, $refPath, $mode, $out)
      $a = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "$root\tools\gen.ps1", "-Name", $name,
        "-PromptFile", "$root\tools\prompts\$name.txt", "-Out", $out, "-Size", $size, "-RefMode", $mode)
      if ($refPath) { $a += @("-Image", $refPath) }
      & powershell @a
    } -ArgumentList $root, $name, $size, $refPath, $mode, $out
  }
  $null = $running | Wait-Job -Any -Timeout 900
  foreach ($j in @($running | Where-Object { $_.State -ne 'Running' })) {
    $r = (Receive-Job $j 2>&1 | ForEach-Object { "$_" } | Select-Object -Last 1) -join " | "
    "$(Get-Date -Format HH:mm:ss) $($j.Name): $r"
    Remove-Job $j
    $running = @($running | Where-Object { $_.Id -ne $j.Id })
  }
}
"ALL DONE"
