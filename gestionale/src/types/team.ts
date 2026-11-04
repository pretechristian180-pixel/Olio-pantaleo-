export type TaskState = "da_iniziare" | "in_corso" | "fatta";

export interface TeamTask {
  id: string;
  title: string;
  note: string | null;
  state: TaskState;
  priority: "normale" | "alta";
  dueDate: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  creatorId: string | null;
  creatorName: string | null;
  contactId: string | null;
  contactName: string | null;
  propertyId: string | null;
  propertyLabel: string | null;
  automatic: boolean;
  doneAt: string | null;
  createdAt: string;
}

export interface NewTask {
  title: string;
  assigneeId: string;
  dueDate: string | null;
  priority: "normale" | "alta";
  note?: string;
  contactId?: string | null;
  propertyId?: string | null;
}

export interface AgentStats {
  agentId: string;
  name: string;
  role: string;
  calls: number;
  messages: number;
  visits: number;
  upcoming: number;
  newContacts: number;
  leads: number;
  leadResponseMinutes: number | null;
  mandates: number;
  offers: number;
  closings: number;
  tasksDone: number;
  tasksOpen: number;
  tasksLate: number;
  lastActivity: string | null;
}
