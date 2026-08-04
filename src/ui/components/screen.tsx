import { Box, Text } from "ink";
import type { ReactNode } from "react";

import { UI_COLORS } from "../../constants/theme.js";

interface ScreenProps {
  readonly context?: string | undefined;
  readonly keys: string;
  readonly children: ReactNode;
}

export const Screen = ({ context, keys, children }: ScreenProps) => (
  <Box
    flexDirection="column"
    borderStyle="round"
    borderColor={UI_COLORS.border}
    paddingX={1}
  >
    <Box justifyContent="space-between">
      <Text bold color={UI_COLORS.brand}>
        Neon
      </Text>
      {context === undefined ? null : <Text dimColor>{context}</Text>}
    </Box>
    <Box flexDirection="column" marginBottom={1}>
      {children}
    </Box>
    <Box
      borderStyle="single"
      borderColor={UI_COLORS.border}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
    >
      <Text dimColor>{keys}</Text>
    </Box>
  </Box>
);
