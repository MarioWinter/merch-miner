import { z } from 'zod';

export const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, 'validation.emailRequired')
      .email('validation.emailInvalid'),
    password: z
      .string()
      .min(8, 'validation.passwordMinLength'),
    confirmPassword: z.string().min(1, 'validation.passwordRequired'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'validation.passwordsNoMatch',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
