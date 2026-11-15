/** Piccolo segnale interno: avvisa i badge quando i messaggi vengono letti. */
type Fn = () => void;
const listeners = new Set<Fn>();
export const onMessagesRead = (fn: Fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const emitMessagesRead = () => listeners.forEach(fn => fn());
