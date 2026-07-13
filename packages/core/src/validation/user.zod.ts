import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email(),
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Only letters, digits, dots, dashes and underscores"),
  password: z.string().min(8),
  displayName: z.string().min(1).max(255),
  defaultEntityId: z.string().uuid().nullable().optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;
