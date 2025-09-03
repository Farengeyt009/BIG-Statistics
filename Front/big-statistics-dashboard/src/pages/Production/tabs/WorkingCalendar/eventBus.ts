// Локальная шина событий для вкладки Working Calendar

type EventMap = {
  'workSchedules:refresh': void;
  'workingCalendar:refresh': void;
};

class EventBus {
  private target: EventTarget;
  constructor() {
    this.target = new EventTarget();
  }
  on<K extends keyof EventMap>(type: K, listener: () => void) {
    this.target.addEventListener(type, listener as EventListener);
    return () => this.off(type, listener);
  }
  off<K extends keyof EventMap>(type: K, listener: () => void) {
    this.target.removeEventListener(type, listener as EventListener);
  }
  emit<K extends keyof EventMap>(type: K) {
    this.target.dispatchEvent(new Event(type));
  }
}

export const workingCalendarEventBus = new EventBus();


