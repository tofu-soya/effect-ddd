import { IDomainEvent } from '@model/effect';

export interface IEventBus {
  publish(event: IDomainEvent): void;
}
