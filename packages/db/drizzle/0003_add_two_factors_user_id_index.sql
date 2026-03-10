-- Add index on two_factors.user_id for efficient lookups by user (e.g. 2FA status).
CREATE INDEX "idx_two_factors_user_id" ON "two_factors" USING btree ("user_id");
