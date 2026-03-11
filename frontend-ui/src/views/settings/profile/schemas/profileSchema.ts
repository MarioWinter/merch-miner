import { z } from 'zod';

export const profileSchema = z.object({
  first_name: z.string().max(150, 'Max 150 characters'),
  last_name: z.string().max(150, 'Max 150 characters'),
  username: z
    .string()
    .min(1, 'Username is required')
    .max(150, 'Max 150 characters')
    .regex(
      /^[\w.@+-]+$/,
      'Only letters, digits, and @/./+/-/_ allowed'
    ),
});

export const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z
      .string()
      .min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

export type ProfileFormValues = z.infer<typeof profileSchema>;
export type PasswordFormValues = z.infer<typeof passwordSchema>;
