import {selectBetterAuthIsAuthenticated} from "@terreno/rtk";
import {Box, Button, Heading, Text, TextField} from "@terreno/ui";
import {useRouter} from "expo-router";
import React, {useCallback, useState} from "react";
import {useDispatch, useSelector} from "react-redux";
import {useAppConfig} from "../components/AppConfigGate";
import {useAuth} from "../components/StoreProvider";
import {useClaimFirstAdminMutation} from "../store/sdk";

/**
 * Shown by `AdminGate` when the backend reports no admin user exists yet
 * (`GET {adminApiBasePath}/setup-status` → `needsSetup: true`). Lets the very first
 * visitor bootstrap admin access without needing a database console:
 * - Anonymous visitor: create an account (better-auth email sign-up), then claim it.
 * - Already signed-in, non-admin visitor (e.g. signed up before an admin was ever
 *   promoted): just claim admin access for the current session.
 *
 * "Claiming" calls the backend's `POST {adminApiBasePath}/setup-claim`, which only
 * succeeds while zero admin users exist — see `AdminApp`'s `firstAdminSetup` option.
 */
const SetupScreen: React.FC = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const {appConfig} = useAppConfig();
  const {authClient, syncSession} = useAuth();
  const isAuthenticated = useSelector(selectBetterAuthIsAuthenticated);
  const apiBase = appConfig.adminApiBasePath ?? "/admin";
  const [claimFirstAdmin, {isLoading: isClaiming}] = useClaimFirstAdminMutation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const claimAndEnter = useCallback(async (): Promise<void> => {
    await claimFirstAdmin({apiBase}).unwrap();
    router.replace("/");
  }, [apiBase, claimFirstAdmin, router]);

  const handleCreateAccount = useCallback(async (): Promise<void> => {
    setError(undefined);
    setIsSubmitting(true);
    try {
      const result = await authClient.signUp.email({email, name, password});
      if (result.error) {
        setError(result.error.message ?? "Failed to create the admin account.");
        return;
      }
      await syncSession(dispatch);
      await claimAndEnter();
    } catch (err) {
      console.error("Setup: account creation failed", err);
      setError("Failed to create the admin account. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [authClient, claimAndEnter, dispatch, email, name, password, syncSession]);

  const handleClaimExisting = useCallback(async (): Promise<void> => {
    setError(undefined);
    setIsSubmitting(true);
    try {
      await claimAndEnter();
    } catch (err) {
      console.error("Setup: claiming admin access failed", err);
      setError("Failed to claim admin access. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [claimAndEnter]);

  const isBusy = isSubmitting || isClaiming;

  return (
    <Box alignItems="center" color="base" flex="grow" justifyContent="center" padding={6}>
      <Box gap={5} maxWidth={420} width="100%">
        <Heading align="center" size="lg">
          {appConfig.brandName}
        </Heading>
        <Text align="center" color="secondaryDark">
          No admin account exists yet.{" "}
          {isAuthenticated
            ? "Claim admin access for your signed-in account to get started."
            : "Create the first admin account to get started."}
        </Text>
        {error ? (
          <Text align="center" color="error" testID="admin-spa-setup-error">
            {error}
          </Text>
        ) : null}
        {isAuthenticated ? (
          <Button
            fullWidth
            loading={isBusy}
            onClick={handleClaimExisting}
            testID="admin-spa-setup-claim"
            text="Claim admin access"
            variant="primary"
          />
        ) : (
          <Box gap={3}>
            <TextField onChange={setName} testID="admin-spa-setup-name" title="Name" value={name} />
            <TextField
              onChange={setEmail}
              placeholder="you@example.com"
              testID="admin-spa-setup-email"
              title="Email"
              type="email"
              value={email}
            />
            <TextField
              onChange={setPassword}
              testID="admin-spa-setup-password"
              title="Password"
              type="password"
              value={password}
            />
            <Button
              fullWidth
              loading={isBusy}
              onClick={handleCreateAccount}
              testID="admin-spa-setup-submit"
              text="Create admin account"
              variant="primary"
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default SetupScreen;
