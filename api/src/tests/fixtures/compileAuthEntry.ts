// Minimal server for the bun-compile auth regression test
// (src/auth.compile.test.ts). Registers a real passport JWT strategy and
// guards one route with authenticateMiddleware, using the same error
// middleware chain as expressServer. Compiled with `bun build --compile`, an
// unauthenticated request must produce a 401 — not a 500 from passport's
// strict-mode-illegal AuthenticationError (`arguments.callee`).

import express from "express";
import passport from "passport";
import {ExtractJwt, Strategy as JwtStrategy} from "passport-jwt";
import {authenticateMiddleware} from "../../auth";
import {apiErrorMiddleware, apiUnauthorizedMiddleware} from "../../errors";

passport.use(
  "jwt",
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: "compile-test-secret",
    },
    (payload, done) => done(null, payload)
  )
);

const app = express();
app.use(passport.initialize());

app.get("/secure", authenticateMiddleware(), (_req, res) => {
  res.json({data: "ok"});
});

app.use(apiUnauthorizedMiddleware);
app.use(apiErrorMiddleware);
// Terreno's fallthrough: anything reaching here surfaces as a 500. The
// regression turns auth failures into exactly this kind of error.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({status: 500, title: `Fallthrough error: ${err.message}`});
});

const port = Number(process.env.PORT ?? 0);
app.listen(port, () => {
  console.info(`LISTENING ${port}`);
});
