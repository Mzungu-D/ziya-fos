-- Prevent an asset from having more than one active assignment.
-- Historical assignments remain allowed because returnedAt is not NULL.

CREATE UNIQUE INDEX "AssetAssignment_one_active_asset_idx"
ON "AssetAssignment" ("assetId")
WHERE "returnedAt" IS NULL;