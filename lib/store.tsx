"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { applyFilters, buildViews, EMPTY_FILTERS, type Filters } from "./filters";
import { getCurrentPosition, type LatLng } from "./geo";
import { getRepo, type AuthState, type Repo } from "./repo";
import type { Member, PlaceInput, PlaceView, Snapshot } from "./types";

export type Editor = { mode: "add"; initial?: Partial<PlaceInput> } | { mode: "edit"; id: string } | null;

interface Toast {
  id: number;
  text: string;
  tone: "info" | "error";
}

interface Store {
  repo: Repo;
  auth: AuthState | null;
  me: Member | null;
  data: Snapshot | null;
  loadError: string | null;
  views: PlaceView[];
  filtered: PlaceView[];
  filters: Filters;
  setFilters: (f: Filters | ((prev: Filters) => Filters)) => void;
  here: LatLng | null;
  locate: () => Promise<LatLng | null>;
  selectedId: string | null;
  select: (id: string | null) => void;
  editor: Editor;
  setEditor: (e: Editor) => void;
  /** Runs a write, refreshes data, and shows the error as a toast if it fails. */
  run: <T>(fn: (repo: Repo) => Promise<T>, success?: string) => Promise<T | undefined>;
  refresh: () => Promise<void>;
  toasts: Toast[];
  toast: (text: string, tone?: Toast["tone"]) => void;
  isAdmin: boolean;
  canEdit: (p: { created_by: string | null }) => boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(() => getRepo(), []);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [data, setData] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [here, setHere] = useState<LatLng | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 5000 : 2500);
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      setAuth(await repo.getAuth());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
      setAuth({ kind: "signed-out" });
    }
  }, [repo]);

  const refresh = useCallback(async () => {
    try {
      setData(await repo.load());
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, [repo]);

  useEffect(() => {
    void refreshAuth();
    return repo.onAuthChange(() => void refreshAuth());
  }, [repo, refreshAuth]);

  const signedIn = auth?.kind === "signed-in";
  useEffect(() => {
    if (!signedIn) return;
    void refresh();
    const unsub = repo.subscribe(() => void refresh());
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      unsub();
      window.removeEventListener("focus", onFocus);
    };
  }, [signedIn, repo, refresh]);

  const run = useCallback(
    async <T,>(fn: (r: Repo) => Promise<T>, success?: string) => {
      try {
        const out = await fn(repo);
        await refresh();
        if (success) toast(success);
        return out;
      } catch (e) {
        toast(e instanceof Error ? e.message : String(e), "error");
        return undefined;
      }
    },
    [repo, refresh, toast],
  );

  const locate = useCallback(async () => {
    try {
      const pos = await getCurrentPosition();
      setHere(pos);
      return pos;
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
      return null;
    }
  }, [toast]);

  const me = auth?.kind === "signed-in" ? auth.me : null;
  // Prefer the live member row (e.g. after a rename) over the one captured at sign-in.
  const meLive = (me && data?.members.find((m) => m.id === me.id)) || me;
  const views = useMemo(() => (data && meLive ? buildViews(data, meLive.id, here) : []), [data, meLive, here]);
  const filtered = useMemo(() => applyFilters(views, filters), [views, filters]);
  const isAdmin = meLive?.role === "admin";

  const value: Store = {
    repo,
    auth,
    me: meLive,
    data,
    loadError,
    views,
    filtered,
    filters,
    setFilters,
    here,
    locate,
    selectedId,
    select: setSelectedId,
    editor,
    setEditor,
    run,
    refresh,
    toasts,
    toast,
    isAdmin,
    canEdit: (p) => !!meLive && (p.created_by === meLive.id || isAdmin),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
