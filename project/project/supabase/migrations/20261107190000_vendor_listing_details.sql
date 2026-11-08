alter table public.products
  add column item_condition text check (item_condition in ('New', 'Like New', 'Good', 'Fair', 'For Parts / Repair')),
  add column condition_notes text check (char_length(condition_notes) <= 2000),
  add column merchandise_types text[] check (
    merchandise_types <@ array['Vintage', 'Antique', 'Collectible', 'Handmade', 'Refurbished', 'Open Box', 'One of a Kind', 'Flea Market', 'Estate Sale']::text[]
  ),
  add column direct_marketplace_listing boolean not null default false;
