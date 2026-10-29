/**
 * Avvisa le schermate aperte che i dati sono cambiati, così si ricaricano
 * (es. dopo aver spuntato una cosa da fare o spostato una trattativa).
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitChange() {
  listeners.forEach((l) => l());
}
