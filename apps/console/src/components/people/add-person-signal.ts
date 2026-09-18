type Listener = () => void;

let pending = false;
const listeners = new Set<Listener>();

export function requestAddPerson(): void {
  pending = true;
  listeners.forEach((listener) => listener());
}

export function subscribeAddPerson(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isAddPersonPending(): boolean {
  return pending;
}

export function consumeAddPerson(): void {
  pending = false;
}
