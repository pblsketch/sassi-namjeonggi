# Codex CLI(image_gen, gpt-image-2)로 이미지 1장을 생성해 $Out에 저장한다.
# 사용: gen.ps1 -Name style_a -PromptFile tools\prompts\style_a.txt -Out design\style-samples\style_a.png [-Size 1536x1024] [-Quality high] [-Image ref.png]
# 프롬프트는 영어(ASCII)로만 쓴다. 명령문 안에 그대로 넣어 넘기므로 한글이 섞이면 깨질 수 있다.
# (codex에게 프롬프트 파일을 읽게 하면 샌드박스 정책이 파일 읽기를 막아 생성이 안 된다.)
param(
  [Parameter(Mandatory=$true)][string]$Name,
  [Parameter(Mandatory=$true)][string]$PromptFile,
  [Parameter(Mandatory=$true)][string]$Out,
  [string]$Size = "1536x1024",
  [string]$Quality = "high",
  [string]$Image = "",
  # same: 참조 이미지의 인물을 그대로(표정만 바꿈) / style: 화풍만 따르고 다른 인물 / scene: 화풍과 등장인물 디자인을 따름
  [string]$RefMode = "same"
)
$ErrorActionPreference = "Continue"
# 데스크톱 앱에 딸린 최신 codex.exe를 우선 쓰고, 없으면 PATH의 codex를 쓴다
$codex = Get-ChildItem "$env:LOCALAPPDATA\OpenAI\Codex\bin" -Recurse -Filter codex.exe -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
if (-not $codex) { $codex = 'codex' }
# 전역 ~/.codex 설정(플러그인·MCP)을 쓰면 시작이 몇 분씩 멈추므로, 최소 설정만 둔 임시 CODEX_HOME을 쓴다
$ch = Join-Path $env:TEMP ("codex-img-sassi-" + $Name)
New-Item -ItemType Directory -Force $ch | Out-Null
$model = "gpt-6-astra"
$m = Select-String -Path "$env:USERPROFILE\.codex\config.toml" -Pattern '^\s*model\s*=\s*"([^"]+)"' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($m) { $model = $m.Matches[0].Groups[1].Value }
Set-Content "$ch\config.toml" @"
model = "$model"
approval_policy = "never"
sandbox_mode = "workspace-write"
"@ -Encoding ascii
Copy-Item "$env:USERPROFILE\.codex\auth.json" "$ch\auth.json" -Force
$prompt = (Get-Content -LiteralPath $PromptFile -Encoding UTF8 -Raw).Replace('"', "'").Trim()
if ($prompt -match '[^\x00-\x7F]') { "WARN $Name : prompt has non-ASCII characters" }
$refNote = ""
$imgArgs = @()
if ($Image -ne "") {
  Copy-Item -LiteralPath $Image -Destination "$ch\ref.png" -Force
  $imgArgs = @("--image=$ch\ref.png")
  $refNote = switch ($RefMode) {
    "style" { " The attached image is an ART STYLE reference only: pass it to image_gen as the reference image and match its painting style, line work, colors and paper texture exactly, but draw the new character described in the prompt, not the people in the reference." }
    "scene" { " The attached image is the art style and character design reference: pass it to image_gen as the reference image, match its painting style exactly, and whenever the lady in indigo-blue, the young official in dark green, the woman in pink and crimson, or the man in grey-brown appear, keep their faces, costumes and colors as in the reference." }
    default { " The attached image is the visual reference: pass it to image_gen as the reference image and keep the character design, face, costume, colors and art style identical." }
  }
}
$before = Get-Date
$env:CODEX_HOME = $ch
$instr = "Call the built-in image_gen tool exactly once to generate 1 image (size $Size, quality $Quality). Do not run any shell commands and do not read any files.$refNote Use everything between <prompt> and </prompt> verbatim as the image prompt. After the image is generated, reply only with DONE.`n<prompt>`n$prompt`n</prompt>"
$log = & $codex exec $instr -C $ch -s workspace-write --skip-git-repo-check -c 'model_reasoning_effort="low"' @imgArgs 2>&1
$log | ForEach-Object { "$_" } | Select-Object -Last 2
$latest = Get-ChildItem -Recurse "$ch\generated_images" -Filter *.png -ErrorAction SilentlyContinue |
  Where-Object { $_.LastWriteTime -gt $before } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latest) {
  New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
  Copy-Item -LiteralPath $latest.FullName -Destination $Out -Force
  "SAVED $Name"
} else { "NO_IMAGE $Name" }
