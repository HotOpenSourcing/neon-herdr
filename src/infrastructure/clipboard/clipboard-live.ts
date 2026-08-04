import { Effect, Layer } from "effect";

import { ClipboardService } from "../../application/ports/clipboard-service.js";
import { ClipboardError } from "../../schemas/errors.js";
import { copyText } from "../../utils/copy-text.js";
import { errorMessage } from "../../utils/error-message.js";

export const ClipboardLive = Layer.succeed(
  ClipboardService,
  ClipboardService.of({
    copy: (value) =>
      copyText(value).pipe(
        Effect.mapError((cause) =>
          ClipboardError.make({
            message: `Could not copy the connection string: ${errorMessage(cause)}`,
            action:
              process.platform === "darwin"
                ? "Ensure pbcopy is available."
                : "Install wl-clipboard or xclip.",
            cause,
          }),
        ),
      ),
  }),
);
