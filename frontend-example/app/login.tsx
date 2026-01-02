import {useRouter} from "expo-router";
import {Box, Button, Heading, Page, Text, TextField} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";
import {useEmailLoginMutation, useEmailSignUpMutation} from "@/store";

const LoginScreen: React.FC = () => {
  const _router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isSignUp, setIsSignUp] = useState<boolean>(false);

  const [emailLogin, {isLoading: isLoginLoading, error: loginError}] = useEmailLoginMutation();
  const [emailSignUp, {isLoading: isSignUpLoading, error: signUpError}] = useEmailSignUpMutation();

  const handleSubmit = useCallback(async () => {
    if (!email || !password) {
      return;
    }

    try {
      if (isSignUp) {
        await emailSignUp({email, password}).unwrap();
      } else {
        await emailLogin({email, password}).unwrap();
      }
      // Navigation will happen automatically when userId is set in the store
    } catch (err) {
      console.error("Authentication error:", err);
    }
  }, [email, password, isSignUp, emailLogin, emailSignUp]);

  const toggleMode = useCallback(() => {
    setIsSignUp(!isSignUp);
  }, [isSignUp]);

  const isLoading = isLoginLoading || isSignUpLoading;
  const error = loginError || signUpError;

  return (
    <Page navigation={undefined}>
      <Box
        alignItems="center"
        alignSelf="center"
        flex="grow"
        justifyContent="center"
        maxWidth={400}
        padding={4}
        width="100%"
      >
        <Box marginBottom={8}>
          <Heading>{isSignUp ? "Sign Up" : "Login"}</Heading>
        </Box>
        <Box style={{gap: 20, width: "100%"}}>
          <TextField
            autoCapitalize="none"
            editable={!isLoading}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            style={{width: "100%"}}
            value={email}
          />

          <TextField
            editable={!isLoading}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            style={{width: "100%"}}
            value={password}
          />

          {Boolean(error) && (
            <Text color="error">{error?.data?.message || "An error occurred"}</Text>
          )}

          <Button
            disabled={!email || !password || isLoading}
            onPress={handleSubmit}
            style={{width: "100%"}}
          >
            {isLoading ? "Loading..." : isSignUp ? "Sign Up" : "Login"}
          </Button>

          <Button disabled={isLoading} onPress={toggleMode} style={{width: "100%"}} variant="text">
            {isSignUp ? "Already have an account? Login" : "Need an account? Sign Up"}
          </Button>
        </Box>
      </Box>
    </Page>
  );
};

export default LoginScreen;
