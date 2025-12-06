# AWS Lambda - OnlySocial Scheduler

Server Lambda per gestire le chiamate API a OnlySocial con rate limiting (max 25 req/min).

## 📋 Struttura

```
server_lambda/
├── src/
│   ├── index.ts              # Lambda handler principale
│   ├── onlysocial-client.ts  # Client API OnlySocial con rate limiting
│   ├── rate-limiter.ts       # Bottleneck rate limiter (25 req/min)
│   └── prisma-client.ts      # Client Prisma per Neon DB
├── dist/                     # Compiled TypeScript (generato da build)
├── package.json
├── tsconfig.json
└── .env                      # Environment variables (gitignored)
```

## 🚀 Setup

### 1. Installa dipendenze

```bash
cd server_lambda
npm install
```

### 2. Configura environment

Copia `.env.example` in `.env` e compila:

```env
DATABASE_URL="postgresql://..."
ONLYSOCIAL_API_TOKEN="..."
ONLYSOCIAL_WORKSPACE_UUID="..."
```

### 3. Genera Prisma Client

```bash
cd ..
npx prisma generate
```

### 4. Build

```bash
npm run build
```

### 5. Package per Lambda

```bash
npm run package
```

Questo crea `lambda.zip` pronto per upload su AWS Lambda.

## 📡 Endpoints

### POST /schedule (Cron Job)
Elabora video schedulati e li pubblica su OnlySocial.

**Response**:
```json
{
  "success": true,
  "results": {
    "processed": 5,
    "successful": 4,
    "failed": 1,
    "errors": ["Video xyz: Account not active"]
  }
}
```

### GET /health
Health check per monitoring.

**Response**:
```json
{
  "status": "healthy",
  "database": "connected",
  "rateLimit": "configured"
}
```

### GET /warm
Warmup ping per prevenire cold start.

## 🔧 Deploy su AWS Lambda

### Opzione 1: AWS Console (UI)

1. Vai su [AWS Lambda Console](https://console.aws.amazon.com/lambda)
2. Crea nuova funzione:
   - Runtime: **Node.js 20.x**
   - Architecture: **x86_64**
   - Memory: **512 MB** (raccomandato)
   - Timeout: **5 minuti**
3. Upload `lambda.zip`
4. Configura Environment Variables:
   - `DATABASE_URL`
   - `ONLYSOCIAL_API_TOKEN`
   - `ONLYSOCIAL_WORKSPACE_UUID`
5. Handler: `index.handler`

### Opzione 2: AWS CLI

```bash
# Crea funzione
aws lambda create-function \
  --function-name onlysocial-scheduler \
  --runtime nodejs20.x \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://lambda.zip \
  --memory-size 512 \
  --timeout 300

# Configura environment
aws lambda update-function-configuration \
  --function-name onlysocial-scheduler \
  --environment Variables="{DATABASE_URL=postgresql://...,ONLYSOCIAL_API_TOKEN=...,ONLYSOCIAL_WORKSPACE_UUID=...}"

# Update codice
npm run deploy
```

### Opzione 3: Terraform (Infrastructure as Code)

```hcl
resource "aws_lambda_function" "onlysocial_scheduler" {
  filename      = "lambda.zip"
  function_name = "onlysocial-scheduler"
  role          = aws_iam_role.lambda_role.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  memory_size   = 512
  timeout       = 300

  environment {
    variables = {
      DATABASE_URL                = var.database_url
      ONLYSOCIAL_API_TOKEN       = var.onlysocial_token
      ONLYSOCIAL_WORKSPACE_UUID  = var.workspace_uuid
    }
  }
}
```

## 🔗 Configura API Gateway

Per esporre Lambda via HTTPS:

1. Crea **HTTP API** in API Gateway
2. Integrazione: Lambda function `onlysocial-scheduler`
3. Route: `POST /schedule`, `GET /health`, `GET /warm`
4. Deploy stage: `prod`
5. URL finale: `https://your-api-id.execute-api.us-east-1.amazonaws.com/prod`

## ⏰ Configura Cron Job

Su [Cron-Job.org](https://console.cron-job.org/):

1. URL: `https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/schedule`
2. Method: `POST`
3. Schedule: `*/5 * * * *` (ogni 5 minuti)
4. Body:
```json
{
  "action": "schedule"
}
```

### Warmup Cron (previene cold start)

1. URL: `https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/warm`
2. Method: `GET`
3. Schedule: `*/5 * * * *` (ogni 5 minuti)

## 🚦 Rate Limiting

Il sistema usa **Bottleneck** per limitare a 25 richieste/minuto verso OnlySocial:

- ✅ Automatico: nessuna configurazione necessaria
- ✅ Queue: richieste in eccesso vengono messe in coda
- ✅ Retry: 3 tentativi automatici se fallisce
- ✅ Logs: tracking dettagliato in CloudWatch

**Esempio**: Se hai 50 video da schedulare, il sistema:
1. Processa i primi 25 in ~1 minuto
2. Aspetta automaticamente
3. Processa i restanti 25 nel minuto successivo

## 💰 Costi Stimati

| Servizio | Uso Mensile | Costo |
|----------|-------------|-------|
| Lambda Invocations | 50,000 | $0.00 (free tier) |
| Lambda Compute (512MB) | 25,000 GB-sec | $0.00 (free tier) |
| API Gateway | 50,000 req | $0.00 (1M gratis) |
| CloudWatch Logs | 5 GB | ~$2.50 |
| **TOTALE** | | **~$2.50/mese** |

## 📊 Monitoring

### CloudWatch Logs

Tutti i log Lambda vanno automaticamente in CloudWatch:
- `/aws/lambda/onlysocial-scheduler`

### Metriche importanti

- **Duration**: Tempo esecuzione (target: <30s)
- **Errors**: Errori Lambda
- **Throttles**: Rate limiting AWS
- **ConcurrentExecutions**: Esecuzioni simultanee

### Allarmi CloudWatch

Configura allarmi per:
- Errors > 5% (alert email/SMS)
- Duration > 4 minuti (rischio timeout)
- Throttles > 0 (concurrency limit)

## 🧪 Test Locale

```bash
npm run test
```

Questo esegue `src/test-local.ts` per testare senza deploy.

## 🔒 Security

### IAM Role per Lambda

Permessi necessari:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

### Secrets Manager (opzionale)

Per maggiore sicurezza, usa AWS Secrets Manager:
```typescript
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

const secret = await secretsManager.getSecretValue({
  SecretId: 'onlysocial/api-token'
});
```

## 🐛 Troubleshooting

### Cold Start Lento
- Aumenta memoria a 1024 MB (CPU più veloce)
- Abilita warmup cron ogni 5 minuti

### Timeout
- Aumenta timeout Lambda a 5 minuti
- Riduci `take: 25` a `take: 10` in query

### Rate Limit OnlySocial
- Verifica logs CloudWatch
- Bottleneck dovrebbe gestire automaticamente
- Se continua: riduci `reservoir: 25` a `reservoir: 20`

### Database Connection Errors
- Verifica `DATABASE_URL` corretto
- Neon richiede `?sslmode=require`
- Verifica firewall Neon (allow AWS IP ranges)

## 📚 Resources

- [AWS Lambda Docs](https://docs.aws.amazon.com/lambda/)
- [API Gateway Docs](https://docs.aws.amazon.com/apigateway/)
- [Bottleneck](https://github.com/SGrondin/bottleneck)
- [Neon Serverless](https://neon.tech/docs/serverless)
