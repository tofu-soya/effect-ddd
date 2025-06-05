export type HasProps<T> = {
  readonly props: T;
};

export type GetProps<T extends HasProps<unknown>> = T['props'];

export type KeyProps<T extends HasProps<unknown>> = keyof T['props'];

export const getRawProps = <A extends HasProps<unknown>>(a: A) => a.props;

export const queryOnProps =
  <A extends HasProps<any>, R = unknown>(key: keyof GetProps<A>) =>
  (a: A) =>
    a.props[key] as R;
