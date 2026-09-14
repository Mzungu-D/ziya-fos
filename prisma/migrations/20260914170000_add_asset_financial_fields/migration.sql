ALTER TABLE "Asset"
  ADD COLUMN "accumulatedDepreciation" DOUBLE PRECISION,
  ADD COLUMN "residualValue" DOUBLE PRECISION,
  ADD COLUMN "depreciationMethod" TEXT,
  ADD COLUMN "usefulLife" INTEGER,
  ADD COLUMN "depreciationStartDate" TIMESTAMP(3);