/** French: 0 and 1 take the singular ("0 essai", "1 essai", "2 essais"). */
export function plural(count: number, singular: string, pluralForm: string): string {
  return count < 2 ? singular : pluralForm;
}
