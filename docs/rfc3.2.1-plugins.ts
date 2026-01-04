export function withRefresh<T>(params: { fn: T }): { refresh: T } {
  return { 
    refresh: params.fn
  }
};

export function withRefreshFactory(): <T>(params: { fn: T }) => ({ refresh: T }) {
  return
}