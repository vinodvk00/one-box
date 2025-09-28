# OneBox - AI-Powered Email Management Platform

<div align="center">
  <img src="https://via.placeholder.com/200x80/4F46E5/FFFFFF?text=OneBox" alt="OneBox Logo" />

  <h3>Intelligent Email Categorization & Management</h3>
  <p>Transform your inbox with AI-powered email categorization, smart reply suggestions, and comprehensive analytics</p>

  [![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/your-username/one-mail)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-19.1.1-blue.svg)](https://reactjs.org/)
  [![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
  [![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Demo](#demo)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## 🌟 Overview

OneBox is a modern, full-stack email management platform that leverages artificial intelligence to automatically categorize emails, suggest intelligent replies, and provide comprehensive analytics. Built with cutting-edge technologies, it offers a seamless experience for managing large volumes of emails efficiently.

### 🎯 Problem Solved

- **Email Overload** - Automatically categorize and prioritize emails
- **Manual Sorting** - AI-powered classification saves hours of manual work
- **Response Time** - Smart reply suggestions speed up email responses
- **Lack of Insights** - Comprehensive analytics and reporting

### ✨ Key Highlights

- 🤖 **AI-Powered Categorization** - Automatically classify emails into meaningful categories
- 💬 **Smart Reply Suggestions** - Generate contextual reply recommendations
- 📊 **Real-time Analytics** - Comprehensive email statistics and insights
- 🔍 **Advanced Search** - Powerful filtering and search capabilities
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile
- ⚡ **Real-time Updates** - Live email processing and categorization

## 🚀 Features

### ✅ Current Features

- [x] **Email Synchronization** - Connect and sync multiple email accounts
- [x] **AI Categorization** - Automatic email classification into 5+ categories
- [x] **Batch Processing** - Process large volumes of emails efficiently
- [x] **Search & Filtering** - Advanced email search with multiple filters
- [x] **Analytics Dashboard** - Comprehensive email statistics and insights
- [x] **RESTful API** - Complete API for all email operations
- [x] **Modern UI** - Clean, responsive React frontend
- [x] **Real-time Updates** - Live categorization status and progress

### 🚧 Upcoming Features

- [ ] **Reply Templates** - Customizable email response templates
- [ ] **Email Training** - Train the AI with custom categorization rules
- [ ] **Multi-language Support** - Support for multiple languages
- [ ] **Email Scheduling** - Schedule emails for later sending
- [ ] **Team Collaboration** - Share and collaborate on email management
- [ ] **Advanced Analytics** - Deeper insights and trend analysis
- [ ] **Mobile App** - Native mobile applications
- [ ] **Integrations** - CRM and productivity tool integrations


## 🏗 Architecture

### Tech Stack

#### Backend
- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **Database:** Elasticsearch
- **AI/ML:** OpenAI GPT API
- **Email:** IMAP (imapflow), Mail Parser
- **Documentation:** Swagger/OpenAPI

#### Frontend
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS + shadcn/ui
- **State Management:** Zustand
- **HTTP Client:** Axios
- **Routing:** React Router DOM

#### DevOps & Tools
- **Code Quality:** ESLint + Prettier
- **Version Control:** Git
- **Package Manager:** npm
- **Environment:** Node.js 18+



## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0 or higher
- **npm** 8.0 or higher
- **Elasticsearch** 8.0+ (local or cloud)
- **OpenAI API Key** for AI categorization

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/one-mail.git
   cd one-mail
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Configure your environment variables
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   # Configure your API endpoint
   npm run dev
   ```

4. **Access the Application**
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:8000`
   - API Documentation: `http://localhost:8000/api-docs`

## 📁 Project Structure

```
one-mail/
├── backend/                 # Node.js + Express API server
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   ├── services/        # Business logic
│   │   ├── models/          # Data models
│   │   ├── routes/          # API routes
│   │   └── utils/           # Utilities
│   ├── package.json
│   └── README.md
├── frontend/                # React + TypeScript client
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Route pages
│   │   ├── hooks/           # Custom hooks
│   │   ├── services/        # API clients
│   │   └── utils/           # Utilities
│   ├── package.json
│   └── README.md
├── docs/                    # Documentation
├── LICENSE
└── README.md               # This file
```

## 📚 API Documentation

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api` | List all emails with filters |
| GET | `/api/search` | Search emails with query |
| GET | `/api/{id}` | Get single email details |
| POST | `/api/{id}/categorize` | Categorize specific email |
| GET | `/api/stats/categories` | Get categorization statistics |
| POST | `/api/batch-categorize` | Start batch categorization |
| GET | `/api/batch-categorize/status` | Get batch processing status |

### Email Categories

- **Interested** - Leads showing genuine interest
- **Meeting Booked** - Calendar invites and confirmations
- **Not Interested** - Rejections and declines
- **Spam** - Promotional and irrelevant content
- **Out of Office** - Auto-reply messages

For complete API documentation, visit `/api-docs` when running the server.

## 💻 Development

### Development Setup

1. **Install dependencies**
   ```bash
   # Backend
   cd backend && npm install

   # Frontend
   cd frontend && npm install
   ```

2. **Environment Configuration**
   ```bash
   # Backend (.env)
   ELASTICSEARCH_URL=http://localhost:9200
   OPENAI_API_KEY=your_openai_api_key
   IMAP_HOST=imap.gmail.com
   IMAP_USER=your_email@gmail.com
   IMAP_PASS=your_app_password

   # Frontend (.env)
   VITE_API_BASE_URL=http://localhost:8000
   ```

3. **Start Development Servers**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev

   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

### Available Scripts

#### Backend
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm start           # Start production server
```

#### Frontend
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

### Code Quality

Both frontend and backend maintain high code quality through:

- **TypeScript** - Strict type checking
- **ESLint** - Code linting with best practices
- **Prettier** - Consistent code formatting
- **Conventional Commits** - Standardized commit messages

## 🚀 Deployment

### Docker Deployment

```dockerfile
# Example docker-compose.yml
version: '3.8'
services:
  backend:
    build: ./backend
    environment:
      - NODE_ENV=production
    ports:
      - "8000:8000"

  frontend:
    build: ./frontend
    ports:
      - "80:80"

  elasticsearch:
    image: elasticsearch:8.0.0
    environment:
      - discovery.type=single-node
    ports:
      - "9200:9200"
```

### Production Deployment

1. **Build Applications**
   ```bash
   cd backend && npm run build
   cd frontend && npm run build
   ```

2. **Deploy to Platform**
   - **Backend:** Heroku, AWS, Digital Ocean, Railway
   - **Frontend:** Vercel, Netlify, AWS S3 + CloudFront
   - **Database:** Elasticsearch Cloud, AWS OpenSearch

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### How to Contribute

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
