"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { TransferInput } from "./transfer";

// Треба було додати зміни в кореневу функцію, щоб мануально додати помилку. Щоб цього не робити, робимо фунцію копію.
export async function transferSwallowError(input: TransferInput) {
  const { fromAccountId, toAccountId, amount } = input;

  const from = await prisma.account.findUnique({
    where: { id: fromAccountId },
  });

  const to = await prisma.account.findUnique({ where: { id: toAccountId } });

  if (!from || !to) {
    throw new Error("Account not found");
  }

  try {
    throw new Error("Unknown error occured");

    await prisma.account.update({
      where: { id: fromAccountId },
      data: { balance: from.balance - amount },
    });

    await prisma.account.update({
      where: { id: toAccountId },
      data: { balance: to.balance + amount },
    });

    await prisma.transfer.create({
      data: { fromAccountId, toAccountId, amount },
    });

    revalidatePath("/");
    return { success: true };
  } catch (e) {
    console.log("Transfer failed", input, e);
    return { success: true };
  }
}
