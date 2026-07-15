"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type TransferInput = {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
};

// Внутрішній P2P-переказ між рахунками.
// Цей код зараз у проді. Він "працює" на демо, але вже були скарги
// від користувачів і кілька дивних балансів у базі.
export async function transferMoney(input: TransferInput) {
  const { userId } = await auth();

  if (!userId) throw new Error("You are not logged in.");

  const { fromAccountId, toAccountId, amount } = input;
  const from = await prisma.account.findUnique({ where: { id: fromAccountId } });
  const to = await prisma.account.findUnique({ where: { id: toAccountId } });

  if (!from) throw new Error("Cannot find destination coming from");
  if (!to) throw new Error("Cannot find destination coming to");
  if (from.currency !== to.currency) throw new Error("The value didnt match.");

  if (from.balance < amount) throw new Error("You dont have enough amount");

  if (from.userId !== userId) throw new Error("You dont have permision for this account");

  if (fromAccountId === toAccountId) {
    throw new Error("Can not transfer on same account");
  }

  try {
   const result = await prisma.$transaction(async (tx) => {
     await tx.account.update({
        where: {
          id: fromAccountId,
        },
        data: { balance: { decrement: amount } },
      });

     await tx.account.update({
        where: { id: toAccountId },
        data: { balance: { increment: amount } },
      });

     await tx.transfer.create({
        data: { fromAccountId, toAccountId, amount },
      });
    }, {isolationLevel:'Serializable'});

    revalidatePath("/");
    return { success: true };
  } catch (e) {
    console.log("Transfer failed", input, e);
    return { success: false };
  }
}
