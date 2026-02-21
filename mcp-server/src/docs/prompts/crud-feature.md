# CRUD Feature Generation

Generate a complete CRUD feature for "{{name}}" with the following specifications:

## Model Fields
{{fieldsList}}
{{ownerField}}

## Requirements

### Backend ({{name}}-backend)
1. Create Mongoose model in `src/models/{{lowerName}}.ts`
2. Create API routes in `src/api/{{lowerName}}.ts` using `modelRouter`
3. Add types to `src/types/models/{{lowerName}}Types.ts`
4. Register routes in `src/server.ts`

### Frontend ({{name}}-frontend)
1. Create list screen at `app/{{lowerName}}/index.tsx`
2. Create detail/edit screen at `app/{{lowerName}}/[id].tsx`
3. Create form component at `components/{{name}}Form.tsx`
4. Regenerate SDK with `bun run sdk`

## Permissions
{{permissionsSection}}

## Implementation Notes
- Use @terreno/api's `modelRouter` for automatic CRUD endpoints
- Use @terreno/ui components (Page, Box, TextField, Button, etc.)
- Use generated SDK hooks for API calls
- Include loading and error states
- Follow Terreno code style guidelines
