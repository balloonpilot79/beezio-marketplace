// Keep every financial record within the API's row limit. Never silently return
// a partial balance when a later page fails.
export async function readAccountingPages<T = any>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>, limit = 100000): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  for (let from = 0; from < limit; from += pageSize) {
    const to = Math.min(from + pageSize, limit) - 1;
    const { data, error } = await query(from, to);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < to - from + 1) return rows;
  }
  throw new Error('Financial history exceeds the report limit; narrow the reporting range.');
}
