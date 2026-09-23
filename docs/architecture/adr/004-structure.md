# ADR-004: Project Structure

## Decision

```
src/
├── app/           # Next.js routes (admin, player, api)
├── components/    # shared UI
├── features/      # feature UI + hooks
├── domain/        # pure domain types & rules
├── services/      # application use cases
├── db/            # drizzle schema, client, migrations helpers
├── lib/           # cross-cutting utils
└── player/        # sync, cache, playback, device (client runtime)
```

## Why

Matches §37 while fitting App Router; keeps Player logic out of admin components.
