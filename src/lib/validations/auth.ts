import { z } from "zod";

export const signupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters.")
      .max(100, "Name must be 100 characters or fewer."),

    email: z
      .string()
      .trim()
      .email("Enter a valid email address.")
      .transform((email) => email.toLowerCase()),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password must be 72 characters or fewer."),

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

// bcrypt only reads the first 72 bytes of a password and silently ignores the
// rest. Characters outside ASCII take more than one byte each.
const BCRYPT_MAX_PASSWORD_BYTES = 72;

const newPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .refine(
    (password) =>
      new TextEncoder().encode(password).length <= BCRYPT_MAX_PASSWORD_BYTES,
    "Password must be 72 characters or fewer. Some characters, such as emoji, count as more than one.",
  );

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