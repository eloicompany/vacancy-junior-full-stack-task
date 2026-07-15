import { prisma } from "@/lib/prisma";
import { TransferForm } from "./TransferForm";

export const dynamic = "force-dynamic";

export default async function Home() {
  const accounts = await prisma.account.findMany({
    orderBy: { ownerName: "asc" },
  });

  return (
    <main>
      <h1>Внутрішні перекази</h1>

      <h2>Рахунки</h2>
      <ul>
        {accounts.map((a) => (
          <li key={a.id}>
            <b>{a.ownerName}</b> ({a.id}) — {a.balance.toString()} {a.currency}
          </li>
        ))}
      </ul>

      <h2>Новий переказ</h2>
      <TransferForm
        accounts={accounts.map((a) => ({
          id: a.id,
          label: `${a.ownerName} — ${a.balance} ${a.currency}`,
        }))}
      />
    </main>
  );
}
