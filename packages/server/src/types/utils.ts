export type MakeRequired<T, K extends keyof T> = Omit<T, K> &
  Required<Pick<T, K>>
