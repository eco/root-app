# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- Build: `pnpm build`
- Development: `pnpm dev`
- Start production: `pnpm start`
- Lint: `pnpm lint`
- Clean: `pnpm clean`

## Code Style

- TypeScript with strict mode enabled
- Path alias: `@/*` → `./src/*`
- ESLint: Next.js core-web-vitals and TypeScript rules
- TailwindCSS for styling
- Component naming: PascalCase
- Imports: Group by external/internal, alphabetize
- Use async/await, not Promises with then/catch
- Prefer functional components with hooks
- Use TypeScript types/interfaces for all props
- Error handling: Use try/catch with proper error logging

## Project Structure

- Next.js 15.3.0 app router
- React 19
- Place components in dedicated files
- Follow Next.js conventions for layouts, pages and components
