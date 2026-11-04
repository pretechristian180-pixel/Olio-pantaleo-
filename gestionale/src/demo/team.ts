/** Versione "anteprima" di src/services/team.ts: cose da fare della squadra e cruscotto di esempio. */
import { emitChange } from "@/services/events";
import type { TaskScope } from "@/services/team";
import type { AgentStats, NewTask, TaskState, TeamTask } from "@/types/team";
import { demoDb } from "./api";

export type { TaskScope };
const wait = <T,>(v: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(v), ms));
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

let tasks: TeamTask[] | null = null;
function all(): TeamTask[] {
  if (tasks) return tasks;
  const [me, claudia] = demoDb.team();
  const c = demoDb.contacts();
  const p = demoDb.properties();
  const who = (a: typeof me) => `${a.firstName} ${a.lastName}`;
  const t = (x: Partial<TeamTask> & Pick<TeamTask, "id" | "title">): TeamTask => ({
    note: null, state: "da_iniziare", priority: "normale", dueDate: day(0), assigneeId: me.id, assigneeName: who(me), creatorId: me.id, creatorName: who(me),
    contactId: null, contactName: null, propertyId: null, propertyLabel: null, automatic: false, doneAt: null, createdAt: ago(30), ...x,
  });
  tasks = [
    t({ id: "tk1", title: `Richiama ${c[0].firstName} ${c[0].lastName}`, contactId: c[0].id, contactName: `${c[0].firstName} ${c[0].lastName}`, priority: "alta", automatic: true }),
    t({ id: "tk2", title: "Prepara la proposta per Via Roma 48", state: "in_corso", propertyId: p[0]?.id ?? null, propertyLabel: p[0]?.address ?? null, dueDate: day(1) }),
    t({ id: "tk3", title: "Porta le chiavi in agenzia per la visita di sabato", assigneeId: claudia.id, assigneeName: who(claudia), dueDate: day(-1), note: "Le chiavi sono nel cassetto del proprietario" }),
    t({ id: "tk4", title: "Fai le foto all'appartamento di Poggiofranco", assigneeId: claudia.id, assigneeName: who(claudia), dueDate: day(2), priority: "alta" }),
    t({ id: "tk5", title: "Rinnova l'incarico del trullo", dueDate: day(-2), automatic: true }),
    t({ id: "tk6", title: "Manda il report al proprietario di Corso Cavour", state: "fatta", doneAt: ago(5), dueDate: day(0) }),
    t({ id: "tk7", title: "Chiama il notaio per il rogito", state: "fatta", doneAt: ago(26), assigneeId: claudia.id, assigneeName: who(claudia), creatorId: claudia.id, creatorName: who(claudia) }),
  ];
  return tasks;
}

export async function listTasks(scope: TaskScope, me: string, done: boolean) {
  const list = all().filter((t) => (t.state === "fatta") === done && (
    scope.kind === "tutte" || (scope.kind === "mie" && t.assigneeId === me) || (scope.kind === "date_da_me" && t.creatorId === me && t.assigneeId !== me) || (scope.kind === "agente" && t.assigneeId === scope.id)));
  return wait(list.map((t) => ({ ...t })));
}
export async function createTask(n: NewTask) {
  const team = demoDb.team();
  const a = team.find((x) => x.id === n.assigneeId) ?? team[0];
  all().unshift({
    id: demoDb.newId("tk"), title: n.title, note: n.note ?? null, state: "da_iniziare", priority: n.priority, dueDate: n.dueDate, assigneeId: a.id, assigneeName: `${a.firstName} ${a.lastName}`,
    creatorId: team[0].id, creatorName: `${team[0].firstName} ${team[0].lastName}`, contactId: n.contactId ?? null, contactName: null, propertyId: n.propertyId ?? null, propertyLabel: null,
    automatic: false, doneAt: null, createdAt: new Date().toISOString(),
  });
  emitChange();
  return wait(undefined);
}
export async function updateTask(id: string, patch: Partial<{ state: TaskState; title: string; assigneeId: string; dueDate: string | null; priority: "normale" | "alta"; note: string | null }>) {
  const t = all().find((x) => x.id === id);
  if (t) {
    if (patch.state) Object.assign(t, { state: patch.state, doneAt: patch.state === "fatta" ? new Date().toISOString() : null });
    if (patch.title !== undefined) t.title = patch.title;
    if (patch.dueDate !== undefined) t.dueDate = patch.dueDate;
    if (patch.priority) t.priority = patch.priority;
    if (patch.note !== undefined) t.note = patch.note;
    if (patch.assigneeId) {
      const a = demoDb.team().find((x) => x.id === patch.assigneeId);
      if (a) Object.assign(t, { assigneeId: a.id, assigneeName: `${a.firstName} ${a.lastName}` });
    }
  }
  emitChange();
}
export async function deleteTask(id: string) {
  tasks = all().filter((t) => t.id !== id);
  emitChange();
}
export async function teamDashboard(days: number): Promise<AgentStats[]> {
  const k = days / 7;
  const [me, claudia] = demoDb.team();
  return wait([
    { agentId: me.id, name: `${me.firstName} ${me.lastName}`, role: "titolare", calls: Math.round(23 * k), messages: Math.round(31 * k), visits: Math.round(6 * k), upcoming: 4, newContacts: Math.round(5 * k), leads: Math.round(4 * k), leadResponseMinutes: 18, mandates: Math.round(1 * k), offers: Math.round(1 * k), closings: days >= 30 ? 1 : 0, tasksDone: Math.round(14 * k), tasksOpen: 3, tasksLate: 1, lastActivity: ago(1) },
    { agentId: claudia.id, name: `${claudia.firstName} ${claudia.lastName}`, role: "agente", calls: Math.round(17 * k), messages: Math.round(22 * k), visits: Math.round(4 * k), upcoming: 3, newContacts: Math.round(3 * k), leads: Math.round(3 * k), leadResponseMinutes: 52, mandates: 0, offers: days >= 30 ? 1 : 0, closings: 0, tasksDone: Math.round(9 * k), tasksOpen: 2, tasksLate: 1, lastActivity: ago(3) },
  ]);
}
