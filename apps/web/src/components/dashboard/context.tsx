"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "@/lib/api";

export type CaseStatus =
  "not_started" | "in_review" | "action_required" | "rejected" | "verified";
export type CaseView = {
  status: CaseStatus;
  note: string | null;
  submittedAt: string | null;
} | null;
export type DemoState = {
  user: { fullName: string; email: string };
  profile: {
    accountType: "personal" | "business";
    businessName: string | null;
    referralCode: string;
    mfaEnabled: boolean;
    notify: Record<string, boolean>;
  };
  verification: { kyc: CaseView; kyb: CaseView };
  unread: number;
};
type Toast = { id: number; message: string; kind: "" | "err" | "warn" };
type Dash = {
  state: DemoState | null;
  version: number;
  refresh: () => void;
  toast: (message: string, kind?: Toast["kind"]) => void;
  hide: boolean;
  setHide: (value: boolean) => void;
  verified: boolean;
};

const Context = createContext<Dash | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState | null>(null);
  const [version, setVersion] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hide, setHideState] = useState(false);
  const counter = useRef(0);

  useEffect(() => {
    let live = true;
    api<DemoState>("demo/state")
      .then((value) => live && setState(value))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [version]);

  useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem("txg-hide") === "1";
    } catch {
      /* storage can be unavailable */
    }
    if (stored) queueMicrotask(() => setHideState(true));
  }, []);

  const setHide = useCallback((value: boolean) => {
    setHideState(value);
    try {
      localStorage.setItem("txg-hide", value ? "1" : "0");
    } catch {
      /* storage can be unavailable */
    }
  }, []);

  const toast = useCallback((message: string, kind: Toast["kind"] = "") => {
    const id = ++counter.current;
    setToasts((list) => [...list, { id, message, kind }]);
    setTimeout(
      () => setToasts((list) => list.filter((item) => item.id !== id)),
      4500,
    );
  }, []);

  const [actions, setActions] = useState(0);
  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
    setActions((n) => n + 1);
  }, []);

  /* Pending items settle on the server after a few seconds; poll briefly. */
  useEffect(() => {
    if (actions === 0) return;
    const timers = [5000, 11000, 17000].map((ms) =>
      setTimeout(() => setVersion((v) => v + 1), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [actions]);

  const value = useMemo(
    () => ({
      state,
      version,
      refresh,
      toast,
      hide,
      setHide,
      verified: state?.verification.kyc?.status === "verified",
    }),
    [state, version, refresh, toast, hide, setHide],
  );

  return (
    <Context.Provider value={value}>
      {children}
      <div className="toast-w" role="status" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`toast ${item.kind}`}>
            {item.message}
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}

export function useDash() {
  const value = useContext(Context);
  if (!value) throw new Error("useDash must be used inside DashboardProvider");
  return value;
}

/** Load a GET endpoint; reloads whenever the dashboard refreshes. */
export function useData<T>(path: string | null) {
  const { version } = useDash();
  const [result, setResult] = useState<{
    path: string | null;
    data?: T;
    error?: string;
  }>({ path: null });
  useEffect(() => {
    if (!path) return;
    let live = true;
    api<T>(path)
      .then((data) => live && setResult({ path, data }))
      .catch(
        (error: Error) => live && setResult({ path, error: error.message }),
      );
    return () => {
      live = false;
    };
  }, [path, version]);
  const current = result.path === path;
  return {
    data: current ? result.data : undefined,
    error: current ? result.error : undefined,
    loading: !current,
  };
}

type Duplicate = { duplicate: true };
const isDuplicate = (value: unknown): value is Duplicate =>
  typeof value === "object" && value !== null && "duplicate" in value;

/** Run a mutation with pending state, toasts and a dashboard refresh. */
export function useAction() {
  const { toast, refresh } = useDash();
  const [pending, setPending] = useState(false);
  const run = useCallback(
    async <T,>(
      task: () => Promise<T>,
      options: {
        success?: string | ((result: T) => string);
        onError?: (message: string) => void;
      } = {},
    ): Promise<T | undefined> => {
      setPending(true);
      try {
        const result = await task();
        if (isDuplicate(result) && result.duplicate)
          toast(
            "Duplicate request blocked. This was already submitted.",
            "warn",
          );
        else if (options.success)
          toast(
            typeof options.success === "function"
              ? options.success(result)
              : options.success,
          );
        refresh();
        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Please try again.";
        if (options.onError) options.onError(message);
        else toast(message, "err");
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [toast, refresh],
  );
  return { pending, run };
}
