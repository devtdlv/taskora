import bcrypt from "bcrypt";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { LoginInput, SignupInput } from "@/lib/validations/auth";

export async function createUser(input: SignupInput) {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  });

  if (existingUser) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    return await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });
  } catch (error) {
    // A concurrent signup can claim the email between the lookup and the insert.
    const isEmailTaken =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.includes("email");

    if (isEmailTaken) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }

    throw error;
  }
}

export async function verifyCredentials(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
  });

  if (!user) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}