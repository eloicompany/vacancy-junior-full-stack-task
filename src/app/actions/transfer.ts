"use server";

import { ensurePositive } from "@/helpers/numbers/ensure-positive";
import {
  ensureAccountOwner,
  ensureDifferentAccounts,
  ensureSameCurrency,
  ensureSufficientBalance,
} from "@/helpers/transfer/validators";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type TransferInput = {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
};

// Внутрішній P2P-переказ між рахунками.
// Цей код зараз у проді. Він "працює" на демо, але вже були скарги
// від користувачів і кілька дивних балансів у базі.

// ========== NEW
// export async function transferMoney(input: TransferInput) {
//   const { fromAccountId, toAccountId, amount } = input;

//   ensurePositive(amount);
//   ensureDifferentAccounts(fromAccountId, toAccountId);

//   const from = await prisma.account.findUnique({
//     where: { id: fromAccountId },
//   });

//   const to = await prisma.account.findUnique({ where: { id: toAccountId } });

//   if (!from || !to) {
//     throw new Error("Account not found");
//   }

//   const authData = await auth();

//   ensureAccountOwner(from, authData.userId);
//   ensureSufficientBalance(from, amount);
//   ensureSameCurrency(from, to); // Або зафетчити конвертацію і перевести у євро перед оновленням балансу отримувача

//   try {
//     await prisma.$transaction(async (tx) => {
//       await tx.account.update({
//         where: { id: fromAccountId },
//         data: { balance: { decrement: amount } },
//       });

//       await tx.account.update({
//         where: { id: toAccountId },
//         data: { balance: { increment: amount } },
//       });

//       await tx.transfer.create({
//         data: { fromAccountId, toAccountId, amount },
//       });
//     });

//     revalidatePath("/");
//     return { success: true };
//   } catch (e) {
//     console.log("Transfer failed", input, e);
//     return { success: false };
//   }
// }

// // ========== WITH BUGS
export async function transferMoney(input: TransferInput) {
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
