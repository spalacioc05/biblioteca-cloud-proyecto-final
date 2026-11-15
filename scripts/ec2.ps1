# Inicia, detiene o consulta la instancia EC2 de demostracion.
# Mantenerla detenida evita el costo de computo y de la IPv4 publica;
# solo se sigue cobrando el volumen EBS de 8 GB.
# Uso: pwsh ./scripts/ec2.ps1 -Accion estado|iniciar|detener [-Stage dev]
param(
  [ValidateSet("estado", "iniciar", "detener")][string]$Accion = "estado",
  [string]$Stage = "dev",
  [string]$Region = "us-east-1"
)
$ErrorActionPreference = "Stop"
$id = aws cloudformation describe-stacks --region $Region --stack-name "biblioteca-cloud-red-$Stage" `
  --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue" --output text

switch ($Accion) {
  "iniciar" {
    aws ec2 start-instances --region $Region --instance-ids $id | Out-Null
    aws ec2 wait instance-running --region $Region --instance-ids $id
  }
  "detener" {
    aws ec2 stop-instances --region $Region --instance-ids $id | Out-Null
    aws ec2 wait instance-stopped --region $Region --instance-ids $id
  }
}
aws ec2 describe-instances --region $Region --instance-ids $id `
  --query "Reservations[0].Instances[0].{Id:InstanceId,Estado:State.Name,Tipo:InstanceType,DNS:PublicDnsName}" --output table
