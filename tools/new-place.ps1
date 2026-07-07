param(
    [Parameter(Mandatory = $true)]
    [string]$City,

    [Parameter(Mandatory = $true)]
    [string]$PlaceSlug,

    [Parameter(Mandatory = $true)]
    [string]$PlaceName,

    [Parameter(Mandatory = $true)]
    [string]$PlannedDate,

    [Parameter(Mandatory = $true)]
    [string]$Description,

    [Parameter(Mandatory = $true)]
    [string]$MapsUrl,

    [string[]]$Tags = @("gezi")
)

$ErrorActionPreference = "Stop"

function Ensure-Dir {
    param([string]$Path)
    if (-not (Test-Path -Path $Path)) {
        New-Item -Path $Path -ItemType Directory | Out-Null
    }
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$citySlug = $City.ToLowerInvariant()

$placeDir = Join-Path $repoRoot "trip-data/places/$citySlug/$PlaceSlug"
$mediaDir = Join-Path $repoRoot "media/places/$citySlug/$PlaceSlug"
$placeJsonPath = Join-Path $placeDir "place.json"
$gitKeepPath = Join-Path $mediaDir ".gitkeep"

Ensure-Dir -Path $placeDir
Ensure-Dir -Path $mediaDir

$jsonData = [ordered]@{
    city = $City
    name = $PlaceName
    plannedDate = $PlannedDate
    description = $Description
    mapsUrl = $MapsUrl
    tags = $Tags
}

$jsonContent = $jsonData | ConvertTo-Json -Depth 4
Set-Content -Path $placeJsonPath -Value $jsonContent -Encoding utf8

if (-not (Test-Path -Path $gitKeepPath)) {
    New-Item -Path $gitKeepPath -ItemType File | Out-Null
}

Write-Host "Olusturuldu:"
Write-Host " - $placeJsonPath"
Write-Host " - $mediaDir"
Write-Host ""
Write-Host "Sonraki adim:"
Write-Host " - Fotograf dosyalarini $mediaDir altina ekleyin."
