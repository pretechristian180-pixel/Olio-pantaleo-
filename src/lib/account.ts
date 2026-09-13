export interface Account {
  nome: string;
  email: string;
}

const ACCOUNT_KEY = "pantaleo-account-v1";

export function getAccount(): Account | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACCOUNT_KEY);
    return raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    return null;
  }
}

export function setAccount(account: Account): void {
  window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
}

export function clearAccount(): void {
  window.localStorage.removeItem(ACCOUNT_KEY);
}
