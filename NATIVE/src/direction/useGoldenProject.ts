import {readNavigatorResume,type NavigatorResume} from './navigatorResume';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SaveSession } from "../persistence/SaveSession";
import type { ProjectSummary } from "../persistence/ProjectRepository";
import { projectV2Schema, type ProjectV2 } from "../domain/projectV2";
import { openGoldenPersistence } from "./persistenceBridge";
import { blankSnapshot, limitsFromProject, type Snapshot, type OptionId } from "./productionBridge";

export function useGoldenProject() {
  const [empty] = useState(blankSnapshot);
  const [session, setSession] = useState<SaveSession | null>(null);
  const [scenario, setScenario] = useState(empty.scenario);
  const [resume,setResume]=useState<NavigatorResume|null>(null);
  const [lastActiveId, setLastActiveId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const subscribe = useCallback((fn: () => void) => session?.subscribe(fn) ?? (() => {}), [session]);
  const snapshot = useCallback(() => session?.snapshot() ?? null, [session]);
  const saved = useSyncExternalStore(subscribe, snapshot);
  const project = saved?.project ?? empty.project;
  const state: Snapshot = {
    version: 2, project,
    scenario: project.scenarios.some(s => s.id === scenario) ? scenario : project.scenarios[0]?.id ?? "",
    draft: project.components.filter(c => c.enabled).map(c => c.id as OptionId),
    chosen: project.selectedPlan?.definition.id ?? null,
    limits: limitsFromProject(project),
  };
  const refresh = useCallback(async () => {
    const { repository,storage } = await openGoldenPersistence();
    setResume(await readNavigatorResume(repository,storage));
    setProjects(await repository.list());
    setLastActiveId(await repository.selectedId());
  }, []);
  useEffect(() => {
    let current = true;
    void openGoldenPersistence().then(async ({ repository,storage }) => ({list:await repository.list(),id:await repository.selectedId(),resume:await readNavigatorResume(repository,storage)})).then(({list,id,resume}) => { if (current) {setProjects(list);setLastActiveId(id);setResume(resume);} }).catch(e => { if (current) setError(String(e)); });
    return () => { current = false; };
  }, []);
  useEffect(() => () => { session?.dispose(); }, [session]);
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (session && session.snapshot().status !== "saved") e.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [session]);
  const switchTo = async (p: ProjectV2) => {
    const { repository, storage } = await openGoldenPersistence();
    const next = new SaveSession(p, (value, revision) => repository.save(value, revision));
    await repository.select(p.id);
    setLastActiveId(p.id);
    const pref = await storage.readSetting(`active-scenario:${p.id}`);
    setScenario(typeof pref === "string" && p.scenarios.some(s => s.id === pref) ? pref : p.scenarios[0]?.id ?? "");
    session?.dispose();
    setSession(next);
    setError("");
    await refresh();
  };
  const settle = async () => {
    if (session && !(await session.settle())) throw session.snapshot().error ?? new Error("Simpanan belum selesai.");
  };
  const create = async (name: string, sample?: ProjectV2) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await settle();
      const { repository } = await openGoldenPersistence();
      const p = sample ?? blankSnapshot().project;
      const next = projectV2Schema.parse({ ...p, id: crypto.randomUUID(), name: name.trim() });
      await switchTo(await repository.save(next, null));
    } finally { busy.current = false; }
  };
  const open = async (id: string) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await settle();
      const { repository } = await openGoldenPersistence();
      const record = await repository.read(id);
      if (!record.project || record.recovered) throw new Error("Simpanan perlu pemulihan. Versi bermasalah tidak dibuka atau ditimpa otomatis.");
      await switchTo(record.project);
    } finally { busy.current = false; }
  };
  const update = (change: Partial<Snapshot>) => {
    if (!session) throw new Error("Buat atau buka proyek terlebih dahulu.");
    const p = change.project ?? session.snapshot().project;

    if (p !== session.snapshot().project) session.update(projectV2Schema.parse(p));
    if (change.scenario) {
      setScenario(change.scenario);
      void openGoldenPersistence().then(({ storage }) => storage.writeSetting(`active-scenario:${p.id}`, change.scenario)).catch(e => setError(String(e)));
    }
  };
  const rescueCopy = async () => {
    if (!session) throw new Error("Buka proyek sebelum membuat salinan pemulihan.");
    if (busy.current) throw new Error("Tunggu operasi proyek sebelumnya selesai.");
    busy.current = true;
    try {
      const p = session.snapshot().project;
      const { repository } = await openGoldenPersistence();
      const copy = projectV2Schema.parse({ ...p, id: crypto.randomUUID(), name: `${p.name.slice(0, 95)} — salinan pemulihan`, revision: 1, createdAt: new Date().toISOString(), importedFrom: { id: p.id, revision: p.revision } });
      await switchTo(await repository.save(copy, null));
    } finally { busy.current = false; }
  };
  const exportBackup = async () => {
    await settle();
    if (!session) throw new Error("Buka proyek sebelum membuat cadangan.");
    const { repository } = await openGoldenPersistence();
    return repository.exportJson(session.snapshot().project.id);
  };
  const remove = async (id: string, expectedRevision: number) => {
    if (busy.current) throw new Error("Tunggu operasi proyek sebelumnya selesai.");
    busy.current = true;
    try {
      const isActive = session?.snapshot().project.id === id;
      if (isActive) await settle();
      const { repository } = await openGoldenPersistence();
      await repository.delete(id, isActive ? session!.snapshot().project.revision : expectedRevision);
      if (isActive) { session!.dispose(); setSession(null); setScenario(empty.scenario); }
      setError("");
      await refresh();
    } finally { busy.current = false; }
  };
  const importBackup = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) throw new Error("Berkas melebihi 10 MiB.");
    await settle();
    const { repository } = await openGoldenPersistence();
    const imported = await repository.importJson(await file.text(), crypto.randomUUID());
    await switchTo(imported.project);
    return imported.warnings;
  };
  return { state, update, rescueCopy, exportBackup, importBackup, create, open, remove, refresh, projects, lastActiveId, resume, active: !!session, status: saved?.status ?? "empty", error: saved?.error?.message ?? error, save: settle };
}
