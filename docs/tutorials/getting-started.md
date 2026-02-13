# Getting Started

Run the example full stack to see Terreno in action.

## Prerequisites

- [Bun](https://bun.sh/) installed
- MongoDB running (for the backend example)

## Steps

1. **Clone and install**

   ```bash
   bun install
   ```

2. **Start the backend** (terminal 1)

   ```bash
   bun run backend:dev
   ```

   Backend runs at `http://localhost:4000`. OpenAPI spec at `/openapi.json`.

3. **Start the frontend** (terminal 2)

   ```bash
   bun run frontend:web
   ```

   Frontend runs in the browser and talks to the backend.

4. **Optional: regenerate SDK** after backend route changes

   ```bash
   cd example-frontend && bun run sdk
   ```

## Next steps

- [How-to guides](../how-to/) — Task-focused guides
- [Reference](../reference/) — Package and API details
