-- S8a X-4: 0323 and 0332 bounded the main money tables; these user-written numeric columns still took NaN and Infinity,
-- and one NaN row poisons every SUM. Same rule as 0323: an open bound of +-1e16 rejects NaN and Infinity in one comparison.
-- No sign rule is added (deltas and adjustments can be negative). NULL stays allowed.
-- Pre-check on live, 2026-11-20: 0 rows out of bound in every column below; the largest absolute value is about 1.2e6.
-- The tables are small (under 300 rows), so NOT VALID then VALIDATE holds each lock only briefly.

alter table public.account_adjustments add constraint account_adjustments_delta_sane check (delta is null or (delta > -1e16 and delta < 1e16)) not valid;
alter table public.budget_categories add constraint budget_categories_amount_sane check (amount is null or (amount > -1e16 and amount < 1e16)) not valid;
alter table public.budget_plans add constraint budget_plans_income_override_sane check (income_override is null or (income_override > -1e16 and income_override < 1e16)) not valid;
alter table public.budget_subcategories add constraint budget_subcategories_amount_sane check (amount is null or (amount > -1e16 and amount < 1e16)) not valid;
alter table public.goals add constraint goals_manual_current_amount_sane check (manual_current_amount is null or (manual_current_amount > -1e16 and manual_current_amount < 1e16)) not valid;
alter table public.goals add constraint goals_monthly_contribution_sane check (monthly_contribution is null or (monthly_contribution > -1e16 and monthly_contribution < 1e16)) not valid;
alter table public.goals add constraint goals_monthly_spending_limit_sane check (monthly_spending_limit is null or (monthly_spending_limit > -1e16 and monthly_spending_limit < 1e16)) not valid;
alter table public.goals add constraint goals_share_pct_sane check (share_pct is null or (share_pct > -1e16 and share_pct < 1e16)) not valid;
alter table public.goals add constraint goals_target_amount_sane check (target_amount is null or (target_amount > -1e16 and target_amount < 1e16)) not valid;
alter table public.income_sources add constraint income_sources_amount_sane check (amount is null or (amount > -1e16 and amount < 1e16)) not valid;
alter table public.profiles add constraint profiles_monthly_rent_sane check (monthly_rent is null or (monthly_rent > -1e16 and monthly_rent < 1e16)) not valid;
alter table public.receipts add constraint receipts_amount_sane check (amount is null or (amount > -1e16 and amount < 1e16)) not valid;
alter table public.recurring_debt_payments add constraint recurring_debt_payments_amount_sane check (amount is null or (amount > -1e16 and amount < 1e16)) not valid;
alter table public.recurring_expenses add constraint recurring_expenses_amount_sane check (amount is null or (amount > -1e16 and amount < 1e16)) not valid;
alter table public.recurring_savings_deposits add constraint recurring_savings_deposits_amount_sane check (amount is null or (amount > -1e16 and amount < 1e16)) not valid;
alter table public.savings_accounts add constraint savings_accounts_target_amount_sane check (target_amount is null or (target_amount > -1e16 and target_amount < 1e16)) not valid;
alter table public.savings_holdings add constraint savings_holdings_current_value_sane check (current_value is null or (current_value > -1e16 and current_value < 1e16)) not valid;
alter table public.savings_holdings add constraint savings_holdings_initial_amount_sane check (initial_amount is null or (initial_amount > -1e16 and initial_amount < 1e16)) not valid;
alter table public.savings_holdings add constraint savings_holdings_karat_adjustment_sane check (karat_adjustment is null or (karat_adjustment > -1e16 and karat_adjustment < 1e16)) not valid;
alter table public.savings_holdings add constraint savings_holdings_quantity_sane check (quantity is null or (quantity > -1e16 and quantity < 1e16)) not valid;
alter table public.savings_holdings add constraint savings_holdings_unit_cost_sane check (unit_cost is null or (unit_cost > -1e16 and unit_cost < 1e16)) not valid;
alter table public.subscriptions add constraint subscriptions_amount_sane check (amount is null or (amount > -1e16 and amount < 1e16)) not valid;
alter table public.subscriptions add constraint subscriptions_my_share_sane check (my_share is null or (my_share > -1e16 and my_share < 1e16)) not valid;
alter table public.subscriptions add constraint subscriptions_pending_amount_sane check (pending_amount is null or (pending_amount > -1e16 and pending_amount < 1e16)) not valid;
alter table public.net_worth_snapshots add constraint net_worth_snapshots_net_worth_sane check (net_worth is null or (net_worth > -1e16 and net_worth < 1e16)) not valid;

alter table public.account_adjustments validate constraint account_adjustments_delta_sane;
alter table public.budget_categories validate constraint budget_categories_amount_sane;
alter table public.budget_plans validate constraint budget_plans_income_override_sane;
alter table public.budget_subcategories validate constraint budget_subcategories_amount_sane;
alter table public.goals validate constraint goals_manual_current_amount_sane;
alter table public.goals validate constraint goals_monthly_contribution_sane;
alter table public.goals validate constraint goals_monthly_spending_limit_sane;
alter table public.goals validate constraint goals_share_pct_sane;
alter table public.goals validate constraint goals_target_amount_sane;
alter table public.income_sources validate constraint income_sources_amount_sane;
alter table public.profiles validate constraint profiles_monthly_rent_sane;
alter table public.receipts validate constraint receipts_amount_sane;
alter table public.recurring_debt_payments validate constraint recurring_debt_payments_amount_sane;
alter table public.recurring_expenses validate constraint recurring_expenses_amount_sane;
alter table public.recurring_savings_deposits validate constraint recurring_savings_deposits_amount_sane;
alter table public.savings_accounts validate constraint savings_accounts_target_amount_sane;
alter table public.savings_holdings validate constraint savings_holdings_current_value_sane;
alter table public.savings_holdings validate constraint savings_holdings_initial_amount_sane;
alter table public.savings_holdings validate constraint savings_holdings_karat_adjustment_sane;
alter table public.savings_holdings validate constraint savings_holdings_quantity_sane;
alter table public.savings_holdings validate constraint savings_holdings_unit_cost_sane;
alter table public.subscriptions validate constraint subscriptions_amount_sane;
alter table public.subscriptions validate constraint subscriptions_my_share_sane;
alter table public.subscriptions validate constraint subscriptions_pending_amount_sane;
alter table public.net_worth_snapshots validate constraint net_worth_snapshots_net_worth_sane;
