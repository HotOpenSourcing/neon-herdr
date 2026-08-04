import { Box, Text } from "ink";

import { UI_COLORS } from "../../constants/theme.js";
import type { SignInProps } from "../../types/ui.js";
import { Screen } from "./screen.js";

export const SignIn = ({
  checking,
  connecting,
  reason,
  authorizationUrl,
  toast,
  signInCommand,
}: SignInProps) => {
  if (checking) {
    return (
      <Screen context="checking session…" keys="ctrl+c quit">
        <Text dimColor>Checking your Neon session…</Text>
      </Screen>
    );
  }
  return (
    <Screen
      context={connecting ? "waiting for browser…" : "not connected"}
      keys={
        connecting
          ? "esc cancel · ? help · q quit"
          : "a sign in · ? help · q quit"
      }
    >
      <Text bold>
        {connecting ? "Waiting for Neon sign-in…" : "Not connected"}
      </Text>
      {reason === undefined ? null : <Text dimColor>{reason}</Text>}
      <Box flexDirection="column" marginTop={1}>
        {connecting ? (
          <>
            <Text>Finish the sign-in in your browser.</Text>
            {authorizationUrl === undefined ? null : (
              <Text color={UI_COLORS.selection} wrap="wrap">
                {authorizationUrl}
              </Text>
            )}
          </>
        ) : (
          <>
            <Text>
              Press <Text bold>a</Text> to sign in with your browser.
            </Text>
            <Text dimColor wrap="wrap">
              Or run: {signInCommand}
            </Text>
          </>
        )}
      </Box>
      {toast === undefined ? null : <Text color="cyan">{toast}</Text>}
    </Screen>
  );
};
