# Compila el frontend con la URL real de la API y lo publica en S3 + CloudFront.
# Uso: pwsh ./scripts/deploy-frontend.ps1 [-Stage dev]
param([string]$Stage = "dev", [string]$Region = "us-east-1")
$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot

function Salida($stack, $clave) {
  aws cloudformation describe-stacks --region $Region --stack-name $stack `
    --query "Stacks[0].Outputs[?OutputKey=='$clave'].OutputValue" --output text
}

$apiUrl = Salida "biblioteca-cloud-$Stage" "HttpApiUrl"
$bucket = Salida "biblioteca-cloud-frontend-$Stage" "BucketName"
$distribucion = Salida "biblioteca-cloud-frontend-$Stage" "DistributionId"
$sitio = Salida "biblioteca-cloud-frontend-$Stage" "SiteUrl"
if (-not $apiUrl -or -not $bucket) { throw "Faltan salidas de los stacks. Despliega primero infra y backend." }

Write-Host "API: $apiUrl"
Write-Host "Bucket: $bucket"

Push-Location (Join-Path $raiz "frontend")
try {
  $env:VITE_API_URL = $apiUrl
  npm ci --no-audit --no-fund
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Fallo el build del frontend" }

  # Archivos con hash: cache de larga duracion. index.html: sin cache.
  aws s3 sync dist "s3://$bucket" --delete --exclude index.html `
    --cache-control "public,max-age=31536000,immutable"
  aws s3 cp dist/index.html "s3://$bucket/index.html" `
    --cache-control "no-cache" --content-type "text/html; charset=utf-8"

  aws cloudfront create-invalidation --distribution-id $distribucion --paths "/index.html" "/" | Out-Null
  Write-Host "Frontend publicado en $sitio"
}
finally {
  Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
  Pop-Location
}
