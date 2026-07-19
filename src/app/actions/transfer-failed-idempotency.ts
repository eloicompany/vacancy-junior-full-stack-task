"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { TransferInput } from "./transfer";

// ========== NEW
// Треба було додати зміни в кореневу функцію, щоб мануально додати помилку. Щоб цього не робити, робимо фунцію копію.
// export async function transferFailedIdempotency(input: TransferInput) {
//   const { fromAccountId, toAccountId, amount } = input;

//   const from = await prisma.account.findUnique({
//     where: { id: fromAccountId },
//   });

//   const to = await prisma.account.findUnique({ where: { id: toAccountId } });

//   if (!from || !to) {
//     throw new Error("Account not found");
//   }

//  try {
//   await prisma.$transaction(async (tx) => {
//     await tx.account.update({
//       where: { id: fromAccountId },
//       data: { balance: { decrement: amount } },
//     });

//     throw new Error("Failed!")

//     await tx.account.update({
//       where: { id: toAccountId },
//       data: { balance: { increment: amount } },
//     });

//     await tx.transfer.create({
//       data: { fromAccountId, toAccountId, amount },
//     });
//   });

//   revalidatePath("/");
//   return { success: true };
// } catch (e) {
//   console.log("Transfer failed", input, e);
//   return { success: false };
// }
// }

// ========== WITH BUGS
export async function transferFailedIdempotency(input: TransferInput) {
  const { fromAccountId, toAccountId, amount } = input;

  const from = await prisma.account.findUnique({
    where: { id: fromAccountId },
  });

  const to = await prisma.account.findUnique({ where: { id: toAccountId } });

  if (!from || !to) {
    throw new Error("Account not found");
  }

  try {
    await prisma.account.update({
      where: { id: fromAccountId },
      data: { balance: { decrement: amount } },
    });

    await prisma.account.update({
      where: { id: toAccountId },
      data: { balance: { increment: amount } },
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
