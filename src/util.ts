export type IsAny<T> = 0 extends (1 & T) ? true : false;

export interface StreamSubscription {
  unsubscribe(): void;
}
