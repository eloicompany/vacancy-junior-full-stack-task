"use server";

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
export async function transferMoney(input: TransferInput) {
  // Додати валідацію на відємну суму
  const { fromAccountId, toAccountId, amount } = input;

  const from = await prisma.account.findUnique({
    where: { id: fromAccountId },
  });

  // додати валідацію що сума переведення не може перебільшувати суму на акаунті
  // додати валідацію що наразі айдішка юзера фром та кореневого юзера співпадають
  // додати валідацію на валюту що є на акаунту - у фром та ту мають бути однакові каренсі
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
