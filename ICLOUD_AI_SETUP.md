# Zero Email AI Setup Guide

This guide will help you set up Zero with local AI email processing for iCloud email management.

## Prerequisites

- **Hardware**: RTX 3080 (10GB VRAM), 128GB RAM, Ryzen 5 CPU ✅ (Your specs are perfect!)
- **Software**: Node.js 18+, pnpm, Docker, Ollama (for local AI)

## 1. Install Ollama for Local AI

1. Download and install Ollama from [https://ollama.com/](https://ollama.com/)

2. Pull the recommended models:
```bash
# Lightweight model for email classification (fits in VRAM)
ollama pull llama3.2:3b

# More capable model for complex analysis
ollama pull llama3.1:8b

# Very fast model for basic tasks
ollama pull phi3.5:mini
```

3. Verify Ollama is running:
```bash
ollama list
```

## 2. Environment Setup

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Add the required environment variables to your `.env` file:
```env
# Existing variables (keep all existing ones)
BETTER_AUTH_SECRET=your_secret_key_here

# iCloud Email Configuration
ICLOUD_EMAIL=your@icloud.com
ICLOUD_APP_PASSWORD=your_app_specific_password

# Local AI Configuration
LOCAL_AI_ENDPOINT=http://localhost:11434
LOCAL_AI_MODEL=llama3.2:3b

# Email Processing Configuration
EMAIL_PROCESSING_ENABLED=true
DAILY_PROCESSING_TIME=08:00
FORWARDING_EMAIL=your-phone@email.com
IMPORTANCE_THRESHOLD=0.7
MAX_DAILY_FORWARDS=10
```

## 3. iCloud App-Specific Password Setup

Since you're using iCloud email, you'll need an app-specific password:

1. Go to [appleid.apple.com](https://appleid.apple.com/)
2. Sign in with your Apple ID
3. Go to "Security" section
4. Under "App-Specific Passwords", click "Generate Password"
5. Enter "Zero Email" as the label
6. Copy the generated password and use it as `ICLOUD_APP_PASSWORD` in your `.env`

## 4. Install Dependencies and Start

```bash
# Install dependencies
pnpm install

# Start the database
pnpm docker:db:up

# Initialize the database
pnpm db:push

# Start the development server
pnpm dev
```

## 5. Configure Email Processing

1. Open [http://localhost:3000](http://localhost:3000)
2. Set up your iCloud account connection
3. Configure importance rules via the settings panel

## 6. Test Local AI

Test your local AI setup:
```bash
curl -X GET http://localhost:8787/api/email-processing/test
```

Expected response:
```json
{
  "success": true,
  "test": {
    "email": {...},
    "classification": {
      "score": 0.95,
      "category": "urgent",
      "reasoning": "Contains urgent keywords and is from important sender",
      "tags": ["urgent", "boss"],
      "shouldForward": true
    }
  }
}
```

## 7. Daily Processing Setup

The system will automatically process emails once per day based on your `DAILY_PROCESSING_TIME` setting. You can also trigger manual processing:

```bash
curl -X POST http://localhost:8787/api/email-processing/process \
  -H "Content-Type: application/json" \
  -d '{"connectionId": "your-connection-id", "dryRun": true}'
```

## API Endpoints

- `GET /api/email-processing/status` - Check AI service status
- `POST /api/email-processing/initialize` - Initialize local AI
- `POST /api/email-processing/classify` - Classify single email
- `POST /api/email-processing/process` - Process daily emails
- `GET /api/email-processing/test` - Test classification

## Customization

### Importance Rules

You can define custom rules in your user preferences:

```typescript
const importanceRules = [
  {
    id: 'urgent-boss',
    name: 'Messages from Boss',
    condition: {
      sender: ['boss@company.com'],
      keywords: ['urgent', 'asap']
    },
    importance: 'urgent',
    autoForward: true
  },
  // Add more rules...
];
```

### AI Models

Adjust the model based on your needs:

- `llama3.2:3b` - Fast, good for basic classification
- `llama3.1:8b` - Balanced speed and quality
- `phi3.5:mini` - Very fast, lower quality

## Hardware Optimization

Your RTX 3080 with 10GB VRAM can handle:
- `llama3.2:3b` - Uses ~3GB VRAM (recommended)
- `llama3.1:8b` - Uses ~8GB VRAM (max recommended)

Your 128GB RAM allows for:
- Running multiple models simultaneously
- Large batch processing
- Keeping models in memory for fast inference

## Troubleshooting

### Local AI Not Working
1. Check if Ollama is running: `ollama list`
2. Verify model is downloaded: `ollama pull llama3.2:3b`
3. Test direct API: `curl http://localhost:11434/api/tags`

### iCloud Connection Issues
1. Verify app-specific password is correct
2. Check 2FA is enabled on your Apple ID
3. Ensure iCloud Mail is enabled

### Email Processing Not Running
1. Check logs for errors
2. Verify environment variables are set
3. Test manual processing with dry run

## Performance Tips

1. **GPU Memory**: Keep VRAM usage under 9GB to leave room for system
2. **Batch Processing**: Process emails in batches of 5-10 for optimal GPU utilization
3. **Model Choice**: Use `llama3.2:3b` for daily processing, `llama3.1:8b` for complex analysis
4. **Scheduling**: Run processing during off-peak hours (early morning)

## Security Notes

- App-specific passwords are stored encrypted
- Local AI processing means your emails never leave your machine
- All email forwarding is done through your own SMTP settings
- No data is sent to external AI services

## Next Steps

1. Set up your importance rules
2. Test with a few sample emails
3. Monitor daily processing results
4. Adjust importance thresholds as needed
5. Add custom forwarding logic if required

Your setup is now ready for intelligent local email management! 🚀
