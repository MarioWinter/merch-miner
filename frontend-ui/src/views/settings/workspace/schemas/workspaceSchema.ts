import { z } from 'zod';

export const workspaceNameSchema = z.object({
  name: z
    .string()
    .min(1, 'Workspace name is required')
    .max(100, 'Max 100 characters'),
});

export const inviteSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
});

export type WorkspaceNameFormValues = z.infer<typeof workspaceNameSchema>;
export type InviteFormValues = z.infer<typeof inviteSchema>;
