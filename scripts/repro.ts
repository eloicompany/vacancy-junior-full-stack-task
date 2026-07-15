import { PrismaClient } from "@prisma/client";
import { transferMoney } from "../src/app/actions/transfer";

const prisma = new PrismaClient();

// Скрипт відтворення бага.
//
// Мета: показати проблему ДО виправлення, а після фіксу — довести, що її більше
// немає. Нижче один приклад-заготовка (списання в мінус). Додай свої сценарії
// для інших знайдених багів.

async function reset() {
  await prisma.transfer.deleteMany();
  await prisma.account.deleteMany();
  await prisma.account.createMany({
    data: [
      { id: "acc-alice", userId: "user-1", ownerName: "Alice", balance: 1000, currency: "USD" },
      { id: "acc-bob", userId: "user-2", ownerName: "Bob", balance: 500, currency: "USD" },
      { id: "acc-carol", userId: "user-3", ownerName: "Carol", balance: 0, currency: "EUR" },
    ],
  });
}

async function balances() {
  const accs = await prisma.account.findMany({ orderBy: { ownerName: "asc" } });
  return Object.fromEntries(accs.map((a) => [a.ownerName, a.balance]));
}
async function bugMissingAwait() {
  console.log("\n── БАГ 1: відсутній await ──");
  await reset();

  await prisma.$transaction(async (tx) => {
/// тут я пропустив await
    tx.account.update({
      where: { id: "acc-alice" },
      data: { balance: { decrement: 100 } },
    });

    await tx.account.update({
      where: { id: "acc-bob" },
      data: { balance: { increment: 100 } },
    });
  });

  const alice = await prisma.account.findUnique({ where: { id: "acc-alice" } });
  const bob = await prisma.account.findUnique({ where: { id: "acc-bob" } });

  console.log("Alice:", alice?.balance); // 1000 не змінився
  console.log("Bob:", bob?.balance);     // 600 отримав гроші з нічого
}

async function bugInsufficientFunds() {
  console.log("баг 2: переказ більше ніж є");
  await reset();

  await prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: "acc-bob" },
      data: { balance: { decrement: 999999 } },
    });
    await tx.account.update({
      where: { id: "acc-alice" },
      data: { balance: { increment: 999999 } },
    });
  });

  const bob = await prisma.account.findUnique({ where: { id: "acc-bob" } });
  console.log("Bob:", bob?.balance); // повинен піти пішов в мінус
}


/// Перевірка виправленого коду
async function verifyFix() {
  console.log("ФІКС: перевірка виправленого коду");

  // Тест 1: переказ більше ніж є
  await reset();
  const r1 = await transferMoney({ fromAccountId: "acc-alice", toAccountId: "acc-bob", amount: 999999 });
  log("ФІКС: відхилено переказ більше ніж є", !r1.success);

  // Тест 2: переказ самому собі
  await reset();
  const r2 = await transferMoney({ fromAccountId: "acc-alice", toAccountId: "acc-alice", amount: 100 });
  log("ФІКС: відхилено переказ на той самий рахунок", !r2.success);

  // Тест 3 успішний переказ
  await reset();
  const r4 = await transferMoney({ fromAccountId: "acc-alice", toAccountId: "acc-bob", amount: 200 });
  const alice = await prisma.account.findUnique({ where: { id: "acc-alice" } });
  const bob   = await prisma.account.findUnique({ where: { id: "acc-bob" } });
}

async function main() {
  await reset();

  console.log("Баланси до:", await balances());

  // Приклад бага: переказуємо більше, ніж є на рахунку.
  // Очікувано: система має відхилити переказ. Фактично — баланс іде в мінус.
  await transferMoney({
    fromAccountId: "acc-bob",
    toAccountId: "acc-alice",
    amount: 999999,
  });

  console.log("Перевірка фіксу")
  bugMissingAwait()
  bugInsufficientFunds()
  await verifyFix();
  console.log("Баланси після:", await balances());
  console.log(
    "Якщо у Bob від'ємний баланс — баг відтворено. Після фіксу переказ має впасти з помилкою."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
