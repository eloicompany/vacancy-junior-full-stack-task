type TransferAccount = {
  id: string;
  userId: string;
  balance: number;
  currency: string;
};

export function ensureDifferentAccounts(fromAccountId: string, toAccountId: string) {
  if (fromAccountId === toAccountId) {
    throw new Error("Cannot transfer money to the same account");
  }
}

export function ensureAccountOwner(account: TransferAccount, userId: string) {
  if (account.userId !== userId) {
    throw new Error("You can transfer money only from your own account");
  }
}

export function ensureSameCurrency(from: TransferAccount, to: TransferAccount) {
  if (from.currency !== to.currency) {
    throw new Error("Cannot transfer money between accounts with different currencies");
  }
}

export function ensureSufficientBalance(account: TransferAccount, amount: number) {
  if (account.balance < amount) {
    throw new Error("Insufficient balance");
  }
}
