-- 007_products_capabilities.sql — per-user "My Products & Capabilities".
-- Run once in Supabase SQL Editor (after 006_group_map.sql).
--
-- One free-form text field per user. The drafter injects it into the prompt
-- so replies can mention a matching product when the post calls for it.
-- Seeds Jim's LO profile only if the field is still empty, same convention
-- as the 004 seed.

alter table public.profiles add column if not exists products_capabilities text;

update public.profiles set products_capabilities = '- Equity lines (HELOCs) on investment properties up to 4 units
- Bank statement equity lines (self-employed, no tax returns needed)
- DSCR equity lines and DSCR purchase/refinance loans (qualify on rental income, not personal income)
- Non-QM: bank statement loans, asset depletion, recent credit events
- Conventional, FHA, VA, jumbo
- MassHousing and Chenoa Fund down payment assistance
- Land loans through a partner lender
- Cash offer / no-contingency program for buyers
- 31 years in the business, licensed in multiple states'
where id = (
  select id from public.profiles
  where email in ('jim@financewithjim.com', 'jim@meploans.com')
    and role = 'loan_officer'
  limit 1
)
and (products_capabilities is null or products_capabilities = '');
