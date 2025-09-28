# OneBox Frontend

<div align="center">
  <h3>AI-Powered Email Management Platform</h3>
  <p>Modern React TypeScript frontend for intelligent email categorization and management</p>

  [![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/your-username/one-mail)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg)](https://www.typescriptlang.org/)
  [![React](https://img.shields.io/badge/React-19.1.1-blue.svg)](https://reactjs.org/)
  [![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development](#development)
- [API Integration](#api-integration)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## 🌟 Overview

OneBox Frontend is a modern, responsive React application that provides an intuitive interface for AI-powered email management. Built with TypeScript and modern development tools, it offers real-time email categorization, intelligent reply suggestions, and comprehensive email analytics.

### Key Capabilities

- **🤖 AI-Powered Categorization** - Automatically classify emails into meaningful categories
- **💬 Smart Reply Suggestions** - Get AI-generated reply recommendations
- **📊 Analytics Dashboard** - Comprehensive email statistics and insights
- **🔍 Advanced Search** - Powerful filtering and search capabilities
- **📱 Responsive Design** - Optimized for desktop and mobile devices
- **⚡ Real-time Updates** - Live email status and categorization updates

## ✨ Features

### ✅ Implemented

- [x] **Dashboard Analytics** - Category statistics with visual charts
- [x] **Email List View** - Paginated table with search and filtering
- [x] **Real-time Categorization** - Live AI categorization with status updates
- [x] **Error Handling** - Comprehensive error boundaries and user feedback
- [x] **Responsive Layout** - Mobile-first design with adaptive navigation
- [x] **Type Safety** - Full TypeScript coverage with strict typing
- [x] **Code Quality** - ESLint + Prettier with pre-commit hooks

### 🚧 Coming Soon

- [ ] **Advanced Filters** - Date ranges, sender filtering, custom categories
- [ ] **Bulk Operations** - Multi-select and batch processing
- [ ] **Email Templates** - Reusable reply templates
- [ ] **Dark Mode** - Theme switching capability
- [ ] **Keyboard Shortcuts** - Power user navigation
- [ ] **Export Features** - CSV/PDF export functionality

## 🛠 Tech Stack

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| [React](https://reactjs.org/) | 19.1.1 | UI Framework |
| [TypeScript](https://www.typescriptlang.org/) | 5.8.3 | Type Safety |
| [Vite](https://vitejs.dev/) | 7.1.7 | Build Tool |
| [Tailwind CSS](https://tailwindcss.com/) | 4.1.13 | Styling |
| [React Router](https://reactrouter.com/) | 7.9.3 | Navigation |

### UI & Components

- **[shadcn/ui](https://ui.shadcn.com/)** - Modern component library
- **[Radix UI](https://www.radix-ui.com/)** - Accessible primitives
- **[Lucide React](https://lucide.dev/)** - Beautiful icons
- **[CVA](https://cva.style/)** - Component variants

### State & Data

- **[Zustand](https://zustand-demo.pmnd.rs/)** - Lightweight state management
- **[Axios](https://axios-http.com/)** - HTTP client with interceptors

### Development Tools

- **[ESLint](https://eslint.org/)** - Code linting
- **[Prettier](https://prettier.io/)** - Code formatting
- **[TypeScript ESLint](https://typescript-eslint.io/)** - TypeScript linting
- **[Vite React Plugin](https://github.com/vitejs/vite-plugin-react)** - Fast refresh

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0 or higher
- **npm** 8.0 or higher
- **Backend API** running (see [backend setup](../backend/README.md))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/one-mail.git
   cd one-mail/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   ```

   Update `.env` with your configuration:
   ```env
   VITE_API_BASE_URL=http://localhost:8000
   VITE_APP_ENV=development
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:5173
   ```

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Base shadcn/ui components (buttons, cards, inputs, etc.)
│   ├── email/          # Email-specific components (lists, filters, details)
│   └── layout/         # Layout components (header, sidebar, navigation)
├── pages/              # Route pages (Dashboard, Emails, Search, Settings)
├── hooks/              # Custom React hooks for state management
├── services/           # External services and API clients
├── stores/             # Global state management (Zustand)
├── types/              # TypeScript type definitions
├── utils/              # Utility functions and helpers
└── styles/             # Global CSS and styling
```

### Key Directories

| Directory | Purpose | Description |
|-----------|---------|-------------|
| `components/` | UI Components | Reusable React components organized by feature |
| `pages/` | Route Pages | Top-level pages mapped to application routes |
| `hooks/` | Custom Hooks | Reusable logic for state management and effects |
| `services/` | External APIs | HTTP clients and external service integrations |
| `stores/` | Global State | Zustand stores for application-wide state |
| `types/` | Type Definitions | TypeScript interfaces and type definitions |
| `utils/` | Utilities | Helper functions, constants, and utilities |
| `styles/` | Styling | Global CSS, Tailwind configuration, and themes |

## 💻 Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |

### Code Quality

The project maintains high code quality through:

- **TypeScript** - Strict type checking
- **ESLint** - Code linting with React/TypeScript rules
- **Prettier** - Consistent code formatting
- **Pre-commit hooks** - Automated quality checks

### Development Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make changes and test**
   ```bash
   npm run dev
   npm run lint
   npm run format:check
   ```

3. **Build and verify**
   ```bash
   npm run build
   npm run preview
   ```

4. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   git push origin feature/your-feature-name
   ```

## 📡 API Integration

### Backend Endpoints

The frontend integrates with the following API endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api` | List all emails with filters |
| GET | `/api/search` | Search emails with query |
| GET | `/api/{id}` | Get single email details |
| POST | `/api/{id}/categorize` | Categorize email |
| GET | `/api/stats/categories` | Get category statistics |
| POST | `/api/batch-categorize` | Start batch categorization |
| GET | `/api/batch-categorize/status` | Get batch status |

### Type Safety

All API responses are fully typed with TypeScript interfaces:

```typescript
interface EmailDocument {
  id: string;
  account: string;
  subject: string;
  from: EmailContact;
  to: EmailContact[];
  date: Date;
  category?: EmailCategory;
  // ... more fields
}

type EmailCategory =
  | "Interested"
  | "Meeting Booked"
  | "Not Interested"
  | "Spam"
  | "Out of Office";
```

### Error Handling

Comprehensive error handling includes:

- **Network errors** - Connection failures and timeouts
- **API errors** - Server responses and validation
- **Runtime errors** - Component error boundaries
- **User feedback** - Toast notifications and error states

## 🚀 Deployment

### Build for Production

```bash
# Install dependencies
npm ci

# Build the application
npm run build

# Preview the build
npm run preview
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API URL | `http://localhost:8000` |
| `VITE_APP_ENV` | Environment | `development` |

### Deployment Platforms

The application can be deployed to:

- **Vercel** - Recommended for React applications
- **Netlify** - Great for static sites
- **AWS S3 + CloudFront** - For enterprise deployments
- **Docker** - Containerized deployment

Example Dockerfile:

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Ensure all tests pass
5. Submit a pull request

### Code Style

- Follow the existing code style
- Use TypeScript for all new code
- Write meaningful commit messages
- Add tests for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <p>Built with ❤️ using React, TypeScript, and modern web technologies</p>
  <p>
    <a href="#">Documentation</a> •
    <a href="#">Report Bug</a> •
    <a href="#">Request Feature</a>
  </p>
</div>
