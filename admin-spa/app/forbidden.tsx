import {Box, Button, Heading, Text} from "@terreno/ui";
import {useRouter} from "expo-router";
import React, {useCallback, useState} from "react";
import {useDispatch} from "react-redux";
import {useAuth} from "../components/StoreProvider";

const ForbiddenScreen: React.FC = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const {authClient, syncSession} = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = useCallback(async (): Promise<void> => {
    setIsSigningOut(true);
    try {
      await authClient.signOut();
      await syncSession(dispatch);
      router.replace("/login");
    } catch (err) {
      console.error("Forbidden: sign-out failed", err);
    } finally {
      setIsSigningOut(false);
    }
  }, [authClient, dispatch, router, syncSession]);

  return (
    <Box
      alignItems="center"
      color="base"
      flex="grow"
      gap={4}
      justifyContent="center"
      padding={6}
      testID="admin-spa-forbidden-screen"
    >
      <Heading align="center" size="lg">
        Admins only
      </Heading>
      <Text align="center" color="secondaryDark">
        You must be an admin to access this page.
      </Text>
      <Button
        loading={isSigningOut}
        onClick={handleSignOut}
        testID="admin-spa-forbidden-signout"
        text="Sign out"
        variant="secondary"
      />
    </Box>
  );
};

export default ForbiddenScreen;
