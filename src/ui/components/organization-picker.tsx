import { Box, Text } from "ink";

import { UI_COLORS } from "../../constants/theme.js";
import { MAX_VISIBLE_ORGANIZATIONS } from "../../constants/ui.js";
import type { OrganizationPickerProps } from "../../types/ui.js";
import { Screen } from "./screen.js";

export const OrganizationPicker = ({
  organizations,
  total,
  cursor,
  query,
  message,
  busy,
}: OrganizationPickerProps) => {
  const start = Math.max(
    0,
    Math.min(
      cursor - Math.floor(MAX_VISIBLE_ORGANIZATIONS / 2),
      organizations.length - MAX_VISIBLE_ORGANIZATIONS
    )
  );
  const visible = organizations.slice(start, start + MAX_VISIBLE_ORGANIZATIONS);
  const nameWidth = Math.min(
    28,
    Math.max(
      12,
      ...organizations.map((organization) => organization.name.length)
    )
  );
  return (
    <Screen
      context={busy ? "switching organization…" : undefined}
      keys="type filter · ↑↓ move · ⏎ select · esc clear · ctrl+c quit"
    >
      <Text bold>Choose an organization</Text>
      {message === undefined ? null : <Text dimColor>{message}</Text>}
      <Box marginTop={1} justifyContent="space-between">
        <Box>
          <Text dimColor>Filter: </Text>
          <Text>{query}</Text>
          <Text inverse> </Text>
        </Box>
        <Text dimColor>
          {organizations.length} of {total}
        </Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {organizations.length === 0 ? (
          <Text dimColor>No organization matches that filter.</Text>
        ) : (
          visible.map((organization, index) => {
            const selected = start + index === cursor;
            return (
              <Text
                key={organization.id}
                bold={selected}
                color={selected ? UI_COLORS.selection : "white"}
              >
                {selected ? "› " : "  "}
                {organization.name.padEnd(nameWidth)}{" "}
                <Text dimColor={!selected}>
                  {organization.handle.padEnd(24)} {organization.plan}
                </Text>
              </Text>
            );
          })
        )}
      </Box>
    </Screen>
  );
};
