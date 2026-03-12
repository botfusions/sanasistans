# CODEBASE.md

> **Auto-generated project context.** Refreshed on every session start.

---

## Project Info

| Property      | Value                                              |
| ------------- | -------------------------------------------------- |
| **Project**   | `asistan`                                          |
| **Framework** | `node`                                             |
| **Type**      | `node`                                             |
| **OS**        | Windows                                            |
| **Path**      | `C:\Users\user\Downloads\Z.ai_claude code\asistan` |

---

## Project Structure

> **Legend:** `file.ts <- A.tsx, B.tsx` = This file is **imported by** A.tsx and B.tsx.
> Directories with `[N files: ...]` are summarized to reduce size.
> [STATS] Showing 93 files. 10 dirs summarized, 5 dirs excluded (node_modules, etc.)

```
dashboard/
  .env
  .eslintrc.json
  .gitignore
  Dockerfile
  app/
    dashboard/
      page.tsx ← page.tsx
    globals.css
    layout.tsx
    page.tsx
  components/
    ToolInventory.tsx
    kokonutui/
      content.tsx ← dashboard.tsx
      dashboard.tsx
      layout.tsx ← dashboard.tsx
      list-01.tsx ← content.tsx
      list-02.tsx ← content.tsx
      list-03.tsx ← content.tsx
      profile-01.tsx ← top-nav.tsx
      sidebar.tsx ← layout.tsx
      top-nav.tsx ← layout.tsx
    theme-provider.tsx
    theme-toggle.tsx ← top-nav.tsx
    ui/ [57 files: 56 .tsx, 1 .ts]
  components.json
  hooks/
    use-data.ts
    use-mobile.ts
    use-toast.ts
  lib/
    supabase.ts
    utils.ts
  middleware.ts
  next.config.mjs
  package-lock.json
  package.json
  postcss.config.mjs
  public/ [9 files: 4 .png, 3 .svg, 2 .jpg]
  styles/
    globals.css
  tailwind.config.js
  tsconfig.json
  tsconfig.tsbuildinfo
data/
  images/ [103 files: 103 .png]
  memory/
    6030287709.json
  orders/
    2026-03-02/
      test-order.xlsx
    2026-03-03/
      pdfs/ [26 files: 26 .pdf]
    2026-03-04/
      SIPARIS FORMU-MARZHAN 03032026.xlsx
      pdfs/
        is_emri_KARKAS__RETIMI_1772637134135.pdf
        is_emri_KARKAS__RETIMI_1772637185170.pdf
    2026-03-05/
      SIPARIS FORMU-MARZHAN 03032026.xlsx
      pdfs/ [20 files: 20 .pdf]
    2026-03-06/
      SIPARIS FORMU-MARZHAN 03032026.xlsx
      pdfs/
        is_emri_KARKAS__RETIMI_1772787394281.pdf
    2026-03-11/
      SIPARIS FORMU-MARZHAN 03032026.xlsx
      pdfs/ [26 files: 26 .pdf]
    2026-03-12/
      SIPARIS FORMU-MARZHAN 03032026.xlsx
      pdfs/
        is_emri_BOYAHANE_1773310177358.pdf
        is_emri_KARKAS__RETIMI_1773310175914.pdf
        is_emri_KUMA__1773310178026.pdf
  orders.json
  processed_uids.json
  production.json
  siparis_arsivi.json
  staff.json
  staff_backup.json
  tasks.json
  tests/ [1 files: 1 .json]
  verilen_siparisler.log
docs/ [8 files: 5 .md, 1 .zip, 1 .pdf]
scripts/
  check-inbox.ts
  check-tg-updates.ts
  cleanup-supabase.ts
  debug-supabase.ts
  diagnose-bot.ts
  force-process.ts
  migrate-to-supabase.ts
  process-uid-12.ts
  send-manual-notify.ts
  verify-db.ts
src/
  assets/ [2 files: 2 .ttf]
  handlers/
    command.handler.ts ← index.ts
    message.handler.ts ← index.ts
  index.ts ← check-inbox.ts, force-process.ts, process-uid-12.ts +2 more
  services/
    webhook.service.ts ← index.ts
  utils/
    analyze-dump.ts
    archival-test.ts
    calendar.service.ts ← command.handler.ts, cron.service.ts
    clear-gmail.ts
    cron.service.ts ← index.ts, timezone_check.ts
    doctor.service.ts ← index.ts, proactive.service.ts
    draft-order.service.ts ← force-process.ts, send-manual-notify.ts, index.ts
    gmail.service.ts ← check-inbox.ts, force-process.ts, process-uid-12.ts +2 more
    i18n.ts ← index.ts, command.handler.ts, cron.service.ts +1 more
    image-embedding.service.ts ← order.service.ts
    kenan.service.ts ← cron.service.ts
    llm.service.ts ← command.handler.ts, message.handler.ts, image-embedding.service.ts +2 more
    logger.ts ← index.ts, webhook.service.ts
    memory.service.ts ← message.handler.ts
    order.service.ts ← force-process.ts, process-uid-12.ts, send-manual-notify.ts +6 more
    proactive.service.ts ← cron.service.ts
    production.service.ts ← command.handler.ts, message.handler.ts, cron.service.ts
    staff.service.ts ← index.ts, command.handler.ts, message.handler.ts +4 more
    supabase.service.ts ← cleanup-supabase.ts, debug-supabase.ts, migrate-to-supabase.ts +4 more
    test-email-send.ts
    test-gmail.ts
    voice.service.ts ← message.handler.ts
    xlsx-utils.ts ← force-process.ts, process-uid-12.ts, index.ts +1 more
tests/ [3 files: 3 .ts]
```

## File Dependencies

> Scanned 124 files

### High-Impact Files

_Files imported by multiple other files:_

| File                         | Imported by |
| ---------------------------- | ----------- |
| `src/lib/utils`              | 54 files    |
| `src/utils/order.service`    | 9 files     |
| `src/utils/supabase.service` | 7 files     |
| `src/utils/staff.service`    | 7 files     |
| `src/components/ui/button`   | 6 files     |

---

_Auto-generated by Maestro session hooks._
