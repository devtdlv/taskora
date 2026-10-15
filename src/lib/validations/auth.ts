import { z } from "zod";

// bcrypt only reads the first 72 bytes of a password and silently ignores the
// rest. Characters outside ASCII take more than one byte each.
export const MAX_PASSWORD_BYTES = 72;

export function passwordByteLength(password: string) {
  return new TextEncoder().encode(password).length;
}

// Every path that sets a password uses this, so none of them can store a
// password that bcrypt would truncate.
const newPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .refine(
    (password) => passwordByteLength(password) <= MAX_PASSWORD_BYTES,
    "Password must be 72 characters or fewer. Some characters, such as emoji, count as more than one.",
  );

const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(100, "Name must be 100 characters or fewer.");

export const signupSchema = z
  .object({
    name: displayNameSchema,

    email: z
      .string()
      .trim()
      .email("Enter a valid email address.")
      .transform((email) => email.toLowerCase()),

    password: newPasswordSchema,

    confirmPassword: z.string(),

    terms: z.literal(true, {
      error: "You must agree to the Terms of Service and Privacy Policy.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .transform((email) => email.toLowerCase()),

  password: z.string().min(1, "Enter your password."),

  remember: z.boolean(),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Emailed tokens are always 32 random bytes encoded as base64url.
const authTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const verifyEmailSchema = z
  .object({
    token: authTokenSchema,
  })
  .strict();

export const resendVerificationSchema = z.object({}).strict();

export const forgotPasswordSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("Enter a valid email address.")
      .transform((email) => email.toLowerCase()),
  })
  .strict();

export const updateProfileSchema = z.strictObject({
  name: displayNameSchema,
});

export const changePasswordSchema = z
  .strictObject({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: newPasswordSchema,
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match.",
    path: ["confirmNewPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "Choose a password that's different from your current one.",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: authTokenSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });