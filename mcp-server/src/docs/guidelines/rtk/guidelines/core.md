### @terreno/rtk

Redux Toolkit Query integration:

- **generateAuthSlice**: Creates auth reducer and middleware with JWT handling
- **emptyApi**: Base RTK Query API for code generation
- **Platform utilities**: Secure token storage (expo-secure-store for native, AsyncStorage for web)

Key imports:

```typescript
import {generateAuthSlice} from "@terreno/rtk";
```

Always use generated SDK hooks — never use `axios` or `request` directly:

```typescript
// Correct
import {useGetYourRouteQuery} from "@/store/openApiSdk";
const {data, isLoading, error} = useGetYourRouteQuery({id: "value"});

// Wrong - don't use axios directly
// const result = await axios.get("/api/yourRoute/value");
```
