create index if not exists idx_lubricant_movements_source_storage on public.lubricant_movements(source_storage_id) where source_storage_id is not null;
create index if not exists idx_lubricant_movements_destination_storage on public.lubricant_movements(destination_storage_id) where destination_storage_id is not null;
create index if not exists idx_lubricant_balances_product on public.lubricant_stock_balances(product_id);
create index if not exists idx_lubricant_readings_product on public.lubricant_stock_readings(product_id);
create index if not exists idx_lubricant_compartments_product on public.lubricant_storage_compartments(product_id);
create index if not exists idx_lubricant_usage_product on public.lubricant_unit_usages(product_id);
