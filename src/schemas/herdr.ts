import { Schema } from "effect";

export const HerdrPaneOpenResponseSchema = Schema.Struct({
  result: Schema.Struct({
    pane: Schema.optional(
      Schema.Struct({
        pane_id: Schema.String,
      }),
    ),
  }),
});
