# Despliegue completo de Biblioteca Cloud en orden:
#   1) Hosting del frontend (S3 privado + CloudFront + OAC)
#   2) Backend serverless (API Gateway + Lambda + DynamoDB + IAM + CloudWatch)
#   3) Build y publicacion del frontend
#   4) (Opcional) Red IaaS: VPC + subred publica + EC2
# Uso: pwsh ./scripts/deploy-all.ps1 [-Stage dev] [-ConRed]
param([string]$Stage = "dev", [string]$Region = "us-east-1", [switch]$ConRed)
$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
$tags = @("Proyecto=biblioteca-cloud", "Etapa=proyecto-final", "Curso=udea-2026-2")

aws sts get-caller-identity --query Account --output text | Out-Null
if ($LASTEXITCODE -ne 0) { throw "AWS CLI no esta autenticado (ejecuta 'aws login')." }

Write-Host "== 1/4 Hosting del frontend =="
aws cloudformation deploy --region $Region --stack-name "biblioteca-cloud-frontend-$Stage" `
  --template-file (Join-Path $raiz "infra/frontend-hosting.yml") `
  --parameter-overrides "Stage=$Stage" --tags $tags --no-fail-on-empty-changeset
if ($LASTEXITCODE -ne 0) { throw "Fallo el stack de hosting" }

Write-Host "== 2/4 Backend serverless =="
Push-Location (Join-Path $raiz "backend")
try {
  npm ci --no-audit --no-fund
  npm test
  if ($LASTEXITCODE -ne 0) { throw "Fallaron las pruebas unitarias" }
  serverless deploy --stage $Stage --region $Region
  if ($LASTEXITCODE -ne 0) { throw "Fallo serverless deploy" }
}
finally { Pop-Location }

Write-Host "== 3/4 Frontend =="
& (Join-Path $PSScriptRoot "deploy-frontend.ps1") -Stage $Stage -Region $Region

if ($ConRed) {
  Write-Host "== 4/4 Red IaaS (VPC + EC2) =="
  aws cloudformation deploy --region $Region --stack-name "biblioteca-cloud-red-$Stage" `
    --template-file (Join-Path $raiz "infra/red-ec2.yml") `
    --parameter-overrides "Stage=$Stage" --capabilities CAPABILITY_NAMED_IAM `
    --tags $tags --no-fail-on-empty-changeset
  if ($LASTEXITCODE -ne 0) { throw "Fallo el stack de red" }
}
else {
  Write-Host "== 4/4 Red IaaS omitida (usa -ConRed para desplegarla) =="
}
