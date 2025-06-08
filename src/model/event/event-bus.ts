import { IDomainEvent } from '@model/interfaces';

export interface IEventBus {
  publish(event: IDomainEvent): void;
}
