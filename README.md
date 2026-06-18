# Portfolio Disruption Radar

This is a Next.js (App Router) + TypeScript project configured with Tailwind CSS, ESLint, and strict TypeScript.

## Folder Structure

- `/src/lib` - Shared utility logic.
- `/src/lib/providers` - External-service wrappers (e.g., AI, News, Email).

## Getting Started

1. **Environment Variables**:
   Copy the `.env.example` file to `.env` and fill in the required API keys.
   ```bash
   cp .env.example .env
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Building for Production

To create an optimized production build:
```bash
npm run build
npm run start
```
