This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Supabase setup

The app uses Supabase Auth and Postgres when these variables are present in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Run [`supabase-schema.sql`](supabase-schema.sql) in the Supabase SQL Editor. It creates the `profiles` and `posts` tables with row-level security. New accounts start with no posts; posts and profile changes are saved per user.

Without these variables, the app stays in local demo mode.

## MongoDB setup

The server-side MongoDB client is available through `src/lib/mongodb.ts`. Add your MongoDB Atlas or local connection details to `.env.local`:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.example.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=safepost
```

The connection is cached between requests during local development. Test the configuration at `GET /api/health/mongodb`; it returns `{ "ok": true }` when the database is reachable. Keep `MONGODB_URI` server-only and never prefix it with `NEXT_PUBLIC_`.

To enforce JSON Schema validation on the `profiles` collection, run:

```bash
node scripts/apply-mongodb-schema.js
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
