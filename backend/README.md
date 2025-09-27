# Onebox - AI-Powered Email Management Platform

## 🎯 Overview
Onebox is an intelligent email aggregator that transforms cold outreach by automatically finding, categorizing, and engaging high-intent leads. Built as a comprehensive email management solution with advanced AI capabilities.

### Key Capabilities
- **Real-time Email Sync**: Multi-account IMAP synchronization without polling
- **AI Categorization**: Automatic classification (Interested/Meeting/Not Interested/Spam/Out of Office)
- **Smart Search**: Elasticsearch-powered full-text search across all accounts
- **Instant Notifications**: Slack & webhook alerts for interested leads
- **AI Reply Suggestions**: RAG-powered contextual response generation

## 🏗️ Architecture

### Tech Stack
- **Runtime**: Node.js with TypeScript
- **Database**: Elasticsearch (with vector storage)
- **Email**: ImapFlow (persistent IDLE connections)
- **AI**: OpenAI API (GPT-4o-mini & text-embedding-3-small)
- **API**: Express.js with Swagger documentation

### Project Structure
```
src/
├── apps/                      # Application initializers
│   └── imap.app.ts           # IMAP sync initialization
├── config/                    # Configuration files
│   ├── accounts.ts           # Email account configs
│   ├── integrations.ts       # Slack/webhook configs
│   └── swagger.ts            # API documentation
├── routes/                    # API endpoints
│   ├── email.routes.ts       # Email CRUD operations
│   └── rag-suggestion-routes/
│       ├── reply.routes.ts   # Reply suggestion endpoints
│       └── training.routes.ts # Training data endpoints
├── services/                  # Business logic
│   ├── ai-categorization.service.ts    # Email categorization
│   ├── batch-categorization.service.ts # Bulk categorization
│   ├── elasticsearch.service.ts        # ES operations
│   ├── imap.service.ts                 # Email sync logic
│   ├── notification.service.ts         # Slack/webhook alerts
│   └── rag-suggestion-services/
│       ├── embedding.service.ts        # Vector embeddings
│       ├── reply-suggestion.service.ts # Reply generation
│       └── vector-store.service.ts     # Training data storage
└── index.ts                   # Application entry point
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker (for Elasticsearch)
- Gmail App Passwords (2 accounts minimum)
- OpenAI API Key

### Installation
```bash
# 1. Clone repository
git clone https://github.com/vinodvk00/onebox.git
cd onebox

# 2. Install dependencies
npm install

# 3. Start Elasticsearch & Kibana
docker-compose up -d

# 4. Configure environment
cp .env.sample .env
# Edit .env with your credentials

# 5. Run application
npm run dev
```

Visit `http://localhost:8000/api-docs` for API documentation.

## 💼 Features & User Flow

### 1. Email Synchronization
Automatically syncs emails from multiple accounts in real-time.
- Fetches last 30 days on startup
- Monitors for new emails continuously
- No manual refresh needed

### 2. AI Categorization
Every email is automatically categorized using OpenAI GPT-4o-mini:
- **Interested**: Leads showing purchase intent → Triggers Slack/webhook
- **Meeting Booked**: Calendar invites and confirmations
- **Not Interested**: Rejections or unsubscribes
- **Spam**: Promotional content
- **Out of Office**: Not available

### 3. Smart Search
Find emails instantly:
- Search across all accounts
- Filter by folder, account, or category
- Full-text search in subjects and bodies

### 4. Reply Suggestions
Get AI-powered reply drafts using OpenAI:
- Train the system with your response templates
- Automatically suggests contextual replies using RAG
- Vector similarity search with OpenAI embeddings
- Includes your meeting links and CTAs

### 5. Integration & Automation
- **Slack**: Instant notifications for interested leads
- **Webhooks**: Trigger external workflows
- **API**: RESTful endpoints for custom integrations

## 📝 API Examples

NOTE: id is combination of "your-email-address" + "_" + "uid - which you can find at the bottom of a email response, its a unique id for every mail" 

example id : mymail@mail.com_123

### Search Emails
```http
GET /api/search?q=product&category=Interested
```

### Get Reply Suggestion
```http
GET /api/emails/{id}/suggest-reply
```

### Add Training Data
```http
POST /api/training
Content-Type: application/json

{
  "scenario": "Demo request",
  "context": "We offer SaaS solutions",
  "response_template": "Thanks! Book a demo at: cal.com/demo"
}
```

### Batch Categorize
```http
POST /api/batch-categorize
```

## 🔧 Environment Variables
```env
PORT=8000

# Gmail Accounts
GMAIL_USER_1=your@gmail.com
GMAIL_APP_PASSWORD_1=your_app_password

GMAIL_USER_2=your2@gmail.com
GMAIL_APP_PASSWORD_2=your_app_password

# AI
OPENAI_API_KEY=your_openai_api_key

# Integrations
SLACK_WEBHOOK_URL=your_slack_webhook
WEBHOOK_SITE_URL=your_webhook_site
```

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api` | Get all emails |
| GET | `/api/search` | Search emails |
| GET | `/api/{id}` | Get single email |
| POST | `/api/{id}/categorize` | Categorize email |
| GET | `/api/uncategorized` | Get uncategorized emails |
| POST | `/api/batch-categorize` | Start batch categorization |
| GET | `/api/stats/categories` | Get category statistics |
| POST | `/api/training` | Add training data |
| GET | `/api/emails/{id}/suggest-reply` | Get reply suggestion |

## 🤖 AI Models Used

### Email Categorization
- **Model**: OpenAI GPT-4o-mini
- **Purpose**: Classifying emails into 5 categories
- **Benefits**: Cost-effective, fast, accurate categorization

### Embeddings & RAG
- **Model**: OpenAI text-embedding-3-small
- **Dimensions**: 1536
- **Purpose**: Vector similarity search for reply suggestions
- **Benefits**: Efficient semantic matching of training data


## 📄 License
ISC - Feel free to use and modify