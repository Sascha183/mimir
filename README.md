# How Computers Work

A static educational site teaching computing fundamentals from first principles. The first module is built around J. Clark Scott's *But How Do It Know?* and walks the learner from a single NAND gate up to a working CPU.

## Stack

- **Astro 5** + **MDX** — content with embedded interactive widgets
- **React** — interactive components (gates, memory bits, RAM grids)
- **Tailwind CSS** — styling
- **TypeScript** — everywhere
- **Cloudflare Pages** — hosting target (any static host works)

## Quickstart

```bash
npm install
npm run dev
```

Open http://localhost:4321.

## Project structure

```
.
├── CLAUDE.md                     # Read this first if using Claude Code
├── public/
│   └── _headers                  # Security headers (CSP, HSTS, etc.) for Cloudflare Pages
├── src/
│   ├── components/               # React interactive widgets
│   │   └── NandGate.tsx          # Example: a working NAND gate widget
│   ├── content/
│   │   ├── config.ts             # Lesson schema (Zod)
│   │   └── lessons/              # MDX lesson files
│   │       └── 02-the-nand-gate.mdx
│   ├── layouts/
│   │   └── LessonLayout.astro    # Page chrome for lessons
│   └── pages/
│       ├── index.astro           # Homepage / lesson index
│       └── lessons/[...slug].astro  # Dynamic lesson route
├── astro.config.mjs
├── tailwind.config.mjs
├── tsconfig.json
└── package.json
```

## Adding a lesson

Copy `src/content/lessons/02-the-nand-gate.mdx` as a template, change the frontmatter, and write the prose. If it needs a new interactive component, build it in `src/components/` first.

The full conventions are documented in [CLAUDE.md](./CLAUDE.md).

## Deploy

The build output in `./dist` is fully static. To deploy to Cloudflare Pages:

1. Push the repo to GitHub/GitLab.
2. In the Cloudflare dashboard, create a new Pages project and connect the repo.
3. Build command: `npm run build`. Build output directory: `dist`.
4. The `public/_headers` file is picked up automatically and applies the CSP and other security headers.

That's the whole deploy. No environment variables, no secrets, no database to provision.

## Security model

This is a static site by design — no backend, no user data, no server-side anything. The attack surface is limited to:

1. The hosting provider (use Cloudflare Pages — strong defaults).
2. Build-time dependencies (run `npm audit` before each deploy; pinned to known versions).
3. The CSP in `public/_headers` (default-deny, explicit allowlist).

Don't add backend services, accounts, or analytics without first reading the security section in `CLAUDE.md`.
