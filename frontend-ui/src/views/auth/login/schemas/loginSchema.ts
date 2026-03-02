import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'validation.emailRequired')
    .email('validation.emailInvalid'),
  password: z.string().min(1, 'validation.passwordRequired'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
