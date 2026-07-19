import { PrismaClient } from "@prisma/client";
import { transferMoney } from "../src/app/actions/transfer";
import { transferSwallowError } from "@/app/actions/transfer-swallow-error";
import { transferFailedIdempotency } from "@/app/actions/transfer-failed-idempotency";

const prisma = new PrismaClient();

// Скрипт відтворення бага.
//
// Мета: показати проблему ДО виправлення, а після фіксу — довести, що її більше
// немає. Нижче один приклад-заготовка (списання в мінус). Додай свої сценарії
// для інших знайдених багів.

export async function reset() {
  await prisma.transfer.deleteMany();
  await prisma.account.deleteMany();
  await prisma.account.createMany({
    data: [
      {
        id: "acc-alice",
        userId: "user-1",
        ownerName: "Alice",
        balance: 1000,
        currency: "USD",
      },
      {
        id: "acc-bob",
        userId: "user-2",
        ownerName: "Bob",
        balance: 500,
        currency: "USD",
      },
      {
        id: "acc-carol",
        userId: "user-3",
        ownerName: "Carol",
        balance: 0,
        currency: "EUR",
      },
    ],
  });
}

export async function balances() {
  const accs = await prisma.account.findMany({ orderBy: { ownerName: "asc" } });
  return Object.fromEntries(accs.map((a) => [a.ownerName, a.balance]));
}

async function main() {
  console.log("BUG 1 REPRODUCTION - NOT HANDLED INSIFFICIENT BALANCE ========================================================");

  await reset();

  console.log("Баланси до:", await balances());

  // Приклад бага: переказуємо більше, ніж є на рахунку.
  // Очікувано: система має відхилити переказ. Фактично — баланс іде в мінус.
  await transferMoney({
    fromAccountId: "acc-bob",
    toAccountId: "acc-alice",
    amount: 999999,
  });

  console.log("Баланси після:", await balances());
  console.log(
    "Якщо у Bob від'ємний баланс — баг відтворено. Після фіксу переказ має впасти з помилкою.",
  );
}

async function invalidAmount() {
  console.log("BUG 2 REPRODUCTION - INVALID AMOUNT =======================================================");
  await reset();

  console.log("Баланси до:", await balances());

  // Переказуємо стрінгу.
  // Очікувано: система має відхилити переказ ще до запиту до бази - перевірка валідності емаунту.
  // Фактично — система пропускає стрінгу - отримуємо помилку рівня бд.


  try {
    await transferMoney({
      fromAccountId: "acc-bob",
      toAccountId: "acc-alice",
      amount: "aafsrdth" as any,
    });
  } catch (e) {
    console.error(e instanceof Error ? e.message : "Error occured");
  }

  console.log("Баланси після:", await balances());
  console.log(
    "Якщо баланси не змінилися, проте отримали помилку від бази - баг відтворено. Після фіксу переказ має впасти зі зрозумілою помилкою ще до запиту до бази даних.",
  );
}

async function minusAmount() {
  console.log("BUG 3 REPRODUCTION - MINUS AMOUNT ===========================================================");
  await reset();

  console.log("Баланси до:", await balances());

  // Переказуємо від'ємний баласн.
  // Очікувано: система має відхилити переказ.
  // Фактично — система опрацьовує запит і віднімає та додає мінусове число з акаунтів.
  await transferMoney({
    fromAccountId: "acc-alice",
    toAccountId: "acc-bob",
    amount: -100,
  });

  console.log("Баланси після:", await balances());
  console.log(
    "Якщо у Alice баланс стане більшим на 100, а у Bob-а менше на 100 — баг відтворено. Після фіксу переказ має впасти з помилкою.",
  );
}

async function transferYourself() {
  console.log("BUG 4 REPRODUCTION - USER TRANSFERS THEMSELVES ========================================================");
  await reset();

  console.log("Баланси до:", await balances());

  // Переказуємо самому собі.
  // Очікувано: система має відхилити переказ.
  // Фактично — система опрацьовує запит і здійснює переказ.
  await transferMoney({
    fromAccountId: "acc-bob",
    toAccountId: "acc-bob",
    amount: 100,
  });

  console.log("Баланси після:", await balances());
  console.log(
    "Якщо у Bob-a баланс стане більшим на 100 - багу відтворено. Після фіксу переказ має впасти з помилкою.",
  );
}

async function transferDifferentCurrency() {
  console.log("BUG 5 REPRODUCTION - DIFFERENT CURRENCY TRANSFERED =====================================================");
  await reset();

  console.log("Баланси до:", await balances());

  // Транзакція між різними валютами. Один акаунт має гроші у доларах, інший - євро.
  // Очікувано: система має відхилити переказ або здійснити конвертацію.
  // Фактично — система опрацьовує запит і здійснює переказ.

  await transferMoney({
    fromAccountId: "acc-alice",
    toAccountId: "acc-carol",
    amount: 10,
  });

  console.log("Баланси після:", await balances());
  console.log(
    "Якщо у Carol стало 10 євро на балансі - багу відворено. Переказані 10 доларів не конвертувалися у євро, система зберігає тепер суму у доларах, обманюючи користувачів.",
  );
}

async function unauthorizedTransfer() {
  console.log("BUG 6 REPRODUCTION - UNAUTHORIZED TRANSFER =====================================================");
  await reset();

  console.log("Баланси до:", await balances());

  // Переказуємо з акаунту, який не належить поточному користувачеві. Поточний користувач - Аліса.
  // Очікувано: система має відхилити переказ.
  // Фактично — система опрацьовує запит і здійснює переказ.
  await transferMoney({
    fromAccountId: "acc-bob",
    toAccountId: "acc-carol",
    amount: 100,
  });

  console.log("Баланси після:", await balances());
  console.log(
    "Якщо у Carol збільшиться баланс на 100 - багу відтворено. Після фіксу переказ має впасти з помилкою, якщо переказ здійснено з акаунту не поточного юзера.",
  );
}


async function swallowedError() {
  console.log("BUG 7 REPRODUCTION - ERROR SWALLOWED =====================================================");
  await reset();

  console.log("Баланси до:", await balances());

  // Здійснбємо переказ, проте ще до початку запитів сталася помилка.
  // Очікувано: система має сказати про це користувачеві.
  // Фактично — система повертає позитивну відповідь. Юзер не розуміє, що відбулося, баланси не змінено.
  await transferSwallowError({
    fromAccountId: "acc-alice",
    toAccountId: "acc-carol",
    amount: 100,
  });

  console.log("Баланси після:", await balances());
  console.log(
    "Якщо юзер не бачить помилку і баланси не змінилися - багу відтворено. Після фіксу юзер має побачити помилку і зрозуміти чого нема змін.",
  );
}


async function failedIdempotency() {
  console.log("BUG 8 REPRODUCTION - FAILED TRANSACTION IDEMPOTENCY =====================================================");
  await reset();

  console.log("Баланси до:", await balances());

  // Здійснюємо переказ, проте після знімання з балансу Аліси, стається помилка.
  // Очікувано: система має повернути гроші Алісі.
  // Фактично — система не повертає гроші Алісі, Боб не отримує гроші також.
  await transferFailedIdempotency({
    fromAccountId: "acc-alice",
    toAccountId: "acc-carol",
    amount: 100,
  });

  console.log("Баланси після:", await balances());
  console.log(
    "Якщо у Alice зменшиться баланс на 100, а Carol не отримає переказ - багу відтворено. Після фіксу Alice має негайно отримати гроші назад після помилки.",
  );
}

async function runAllTests() {
  const tests = [
    { name: "main", fn: main },
    { name: "invalidAmount", fn: invalidAmount },
    { name: "minusAmount", fn: minusAmount },
    { name: "transferYourself", fn: transferYourself },
    { name: "transferDifferentCurrency", fn: transferDifferentCurrency },
    { name: "unauthorizedTransfer", fn: unauthorizedTransfer },
    { name: "swallowedError", fn: swallowedError },
    { name: "failedIdempotency", fn: failedIdempotency },
  ];

  for (const test of tests) {
    try {
      console.log(`--- Running: ${test.name} ---`);
      await test.fn();
      console.log(`${test.name} passed.`);
    } catch (e) {
      console.error(`❌ ${test.name} failed:`, e instanceof Error ? e.message : "Error occured");
    }
  }

  await prisma.$disconnect();
}

runAllTests();
