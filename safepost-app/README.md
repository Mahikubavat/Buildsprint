# SafePost App

SafePost is a Next.js application for reviewing and rewriting social media posts with safety and compliance checks. It helps users assess risk, flag risky phrases, and generate safer alternatives before publishing.

## Features

- Social post review dashboard
- Platform-aware content analysis
- Risk scoring and flagged phrase detection
- AI-assisted rewrite suggestions
- Profile management with workspace tracking
- Supabase authentication support
- MongoDB-backed workspace and post persistence
- Local API key storage for Gemini-based rewrite generation

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- MongoDB
- Supabase
- Gemini API

## Project Structure

```text
safepost-app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── health/mongodb/route.ts
│   │   │   ├── rewrite/route.ts
│   │   │   └── workspace/route.ts
│   │   ├── fonts/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── lib/
│       ├── mongodb.ts
│       └── supabase.ts
├── scripts/
│   └── apply-mongodb-schema.js
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── supabase-schema.sql
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

## Prerequisites

Before running the project, make sure you have:

- Node.js 18 or newer
- npm
- A MongoDB instance or connection string
- A Supabase project
- A Gemini API key for rewrite analysis

## Environment Variables

Create a `.env.local` file in the project root with variables similar to:

```env
NEXT_PUBLIC_SUPABASE_URL="your_supabase_url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
MONGODB_URI="mongodb://localhost:27017/safepost"
GEMINI_API_KEY="your_gemini_api_key"
```

> The app also supports saving the Gemini API key in the browser local storage from the user profile screen.

## Installation

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Production Build

```bash
npm run build
npm run start
```

## API Overview

- `/api/rewrite` — analyzes post content and returns risk score, flagged phrases, and suggested rewrite
- `/api/workspace` — loads or persists user workspace profile and posts
- `/api/health/mongodb` — checks MongoDB availability

## Notes

- The app stores user profile and workspace data in MongoDB when available.
- Auth and API key state are persisted in the browser local storage for convenience.
- For production use, always validate and secure API keys and sensitive environment values.

## License

This project is currently for internal/demo use unless otherwise specified by the repository owner.
