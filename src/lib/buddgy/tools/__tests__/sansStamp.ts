/** An undo puts a row back with a fresh edit time (QA-41), so "the same row" is compared without the stamp. */
export const sansStamp = <T>(value: T): T => JSON.parse(JSON.stringify(value, (key, v) => (key === 'updatedAt' ? undefined : v)))
