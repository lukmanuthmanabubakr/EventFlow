-- Backstop: stock can never go negative, whatever the application code does.
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_quantityAvailable_nonnegative"
  CHECK ("quantityAvailable" >= 0);
