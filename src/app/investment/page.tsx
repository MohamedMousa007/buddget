/**
 * `/investment` — kept as an alias of `/wealth`.
 *
 * This route used to be 37 lines that rendered the same `InvestmentView` the savings
 * page already showed. It is now the Invested segment of the merged Wealth page; the
 * path survives only so old deep links resolve.
 */
export { default } from '@/app/wealth/page'
