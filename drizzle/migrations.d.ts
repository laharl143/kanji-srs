// Types for the drizzle-kit generated migrations.js (Expo driver). Kept by hand: drizzle-kit
// rewrites migrations.js on each `npm run db:generate` but leaves this file alone.
declare const migrations: {
  journal: { entries: { idx: number; when: number; tag: string; breakpoints: boolean }[] };
  migrations: Record<string, string>;
};
export default migrations;
