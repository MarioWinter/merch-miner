import { z } from 'zod';

export const passwordResetSchema = z.object({
  email: z
    .string()
    .min(1, 'validation.emailRequired')
    .email('validation.emailInvalid'),
});

export type PasswordResetFormValues = z.infer<typeof passwordResetSchema>;

export const passwordConfirmSchema = z
  .object({
    new_password: z
      .string()
      .min(8, 'validation.passwordMinLength'),
    confirmPassword: z.string().min(1, 'validation.passwordRequired'),
  })
  .refine((data) => data.new_password === data.confirmPassword, {
    message: 'validation.passwordsNoMatch',
    path: ['confirmPassword'],
  });

export type PasswordConfirmFormValues = z.infer<typeof passwordConfirmSchema>;
