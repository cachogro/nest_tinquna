export class ColumnNumericTransformer {
  to(data: number): number {
    return data;
  }
  from(data: string | null): number | null {
    return data === null ? null : parseFloat(data);
  }
}
