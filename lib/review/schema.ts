import { z } from "zod";

export const ChecklistOutput = z.object({
  items: z
    .array(z.object({ text: z.string(), lookAt: z.string() }))
    .min(3)
    .max(6),
});
