# Add organizations to a Terreno app

Enable organizations only when the app is multi-tenant. Existing single-tenant
apps can omit every option in this guide.

## 1. Enable organization RBAC

``````typescript
import {createAccess, terrenoStatements} from "@terreno/api";

export const access = createAccess({
  connection: mongoose.connection,
  organizations: true,
  statements: terrenoStatements,
  userModel: User,
});

await access.roles.seedDefaults();
``````

This adds Membership-based `org-admin` grants and seeds the locked `operator`
role. It does not change apps that omit `organizations`.

## 2. Mount organization routes

``````typescript
const app = new TerrenoApp({
  accessControl: access,
  organizations: true,
  userModel: User,
});
``````

This mounts `OrgsApp` at `/orgs`. To configure audit handling or a different
path, pass an options object:

``````typescript
organizations: {
  basePath: "/organizations",
  onOrgAudit: recordOrganizationAudit,
}
``````

## 3. Scope tenant models

Add `orgScopedPlugin` to models that use ObjectId organization keys. Put
`orgContextMiddleware({required: true})` before their routes, use
`OrgQueryFilter` for lists, and overwrite client organization ids during
create:

``````typescript
schema.plugin(orgScopedPlugin);

app.use("/projects", authenticateMiddleware(), orgContextMiddleware({required: true}));

modelRouter("/projects", Project, {
  preCreate: (body) => ({
    ...body,
    organizationId: getOrgContext()?.organization?._id,
  }),
  queryFilter: OrgQueryFilter,
});
``````

For admin CRUD, use `new AdminApp({accessControl: access, organizations:
true})`. Models with an `organizationId` schema path are scoped automatically.

## 4. Send organization context

Send `X-Organization-Id` on tenant-scoped requests. `org-admin` callers with
exactly one administered organization may omit it; Terreno infers that org.
Operators and superadmins must select an org.

Frontend admin hosts use `OrgContextProvider` + `OrgSwitcher`.
`useAdminApi` adds the selected organization header automatically.

## Example app accounts

After `bun run backend:seed`, all accounts use password `testpassword123`:

| Account | Access |
| --- | --- |
| `operator@example.com` | Platform organization directory; may enter either org |
| `orgadmin-alpha@example.com` | Org admin for Alpha Workspace |
| `orgadmin-beta@example.com` | Org admin for Beta Workspace |
| `test@example.com` | Member of Alpha Workspace |
| `admin@example.com` / `superadmin@example.com` | Existing example superadmin accounts |

The seed creates Alpha Workspace and Beta Workspace plus two projects in Alpha
Workspace. Membership rows, not fields on User, are the source of tenant access.
