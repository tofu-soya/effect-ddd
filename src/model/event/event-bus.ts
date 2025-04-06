import { DomainEvent } from './domain-event.base';

export interface IEventBus {
  publish(event: DomainEvent): void;
}
