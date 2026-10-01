import {
  buildForecastFeatures,
  getForecastDataset,
  type FinancialDataset,
  type ForecastFeatureRow,
} from "./financialData.service";

const MIN_TRAINING_MONTHS = 6;
const DEFAULT_HISTORY_MONTHS = 24;
const MAX_HISTORY_MONTHS = 120;

const DEFAULT_FORECAST_MONTHS = 6;
const MAX_FORECAST_MONTHS = 24;

const MIN_CONFIDENCE = 0.5;
const MAX_CONFIDENCE = 0.99;

const MONEY_TOLERANCE = 0.01;

export type ForecastMetric =
  | "REVENUE"
  | "EXPENSES"
  | "NET_PROFIT";

export type ForecastModel =
  | "TREND_SEASONALITY"
  | "INSUFFICIENT_DATA";

export type ForecastReadiness =
  | "READY"
  | "INSUFFICIENT_DATA"
  | "NOT_READY";

export interface ForecastPoint {
  month: string;
  year: number;
  monthNumber: number;

  revenue: number;
  expenses: number;
  netProfit: number;

  revenueLower: number;
  revenueUpper: number;

  expensesLower: number;
  expensesUpper: number;

  netProfitLower: number;
  netProfitUpper: number;
}

export interface ForecastAccuracy {
  metric: ForecastMetric;
  meanAbsoluteError: number;
  meanAbsolutePercentageError: number | null;
  rootMeanSquareError: number;
  observations: number;
}

export interface ForecastDiagnostics {
  model: ForecastModel;
  trainingMonths: number;
  forecastMonths: number;

  confidenceLevel: number;

  trendStrength: {
    revenue: number;
    expenses: number;
    netProfit: number;
  };

  seasonalityDetected: {
    revenue: boolean;
    expenses: boolean;
    netProfit: boolean;
  };

  accuracy: ForecastAccuracy[];

  warnings: string[];
}

export interface FinancialForecast {
  organizationId: string;
  currency: string;

  generatedAt: string;

  historicalPeriod: {
    startDate: string;
    endDate: string;
    observations: number;
  };

  forecastPeriod: {
    startMonth: string;
    endMonth: string;
    months: number;
  };

  readiness: {
    status: ForecastReadiness;
    message: string;
  };

  model: {
    name: ForecastModel;
    version: string;
  };

  forecast: ForecastPoint[];

  totals: {
    historicalRevenue: number;
    historicalExpenses: number;
    historicalNetProfit: number;

    forecastRevenue: number;
    forecastExpenses: number;
    forecastNetProfit: number;
  };

  diagnostics: ForecastDiagnostics;
}

interface NumericSeries {
  values: number[];
  months: string[];
}

interface RegressionResult {
  intercept: number;
  slope: number;
  fitted: number[];
  residuals: number[];
  rmse: number;
  rSquared: number;
}

interface SeasonalityResult {
  indexes: number[];
  detected: boolean;
}

interface MetricForecast {
  values: number[];
  lower: number[];
  upper: number[];

  regression: RegressionResult;
  seasonality: SeasonalityResult;
}

function normalizeOrganizationId(
  organizationId: unknown
): string {
  if (
    typeof organizationId !== "string" ||
    !organizationId.trim()
  ) {
    throw new Error(
      "FORECAST_ORGANIZATION_REQUIRED"
    );
  }

  return organizationId.trim();
}

function roundMoney(
  value: number
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(
    (value + Number.EPSILON) * 100
  ) / 100;
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value)
  );
}

function parsePositiveInteger(
  value: unknown,
  fallback: number,
  maximum: number,
  errorCode: string
): number {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).trim());

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    throw new Error(errorCode);
  }

  return Math.min(
    parsed,
    maximum
  );
}

function normalizeConfidence(
  value: unknown
): number {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0.95;
  }

  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).trim());

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0 ||
    parsed >= 1
  ) {
    throw new Error(
      "FORECAST_INVALID_CONFIDENCE"
    );
  }

  return clamp(
    parsed,
    MIN_CONFIDENCE,
    MAX_CONFIDENCE
  );
}

function sum(
  values: number[]
): number {
  return values.reduce(
    (total, value) =>
      total + value,
    0
  );
}

function mean(
  values: number[]
): number {
  if (!values.length) {
    return 0;
  }

  return (
    sum(values) /
    values.length
  );
}

function median(
  values: number[]
): number {
  if (!values.length) {
    return 0;
  }

  const sorted =
    [...values].sort(
      (a, b) => a - b
    );

  const middle =
    Math.floor(
      sorted.length / 2
    );

  if (
    sorted.length % 2 ===
    0
  ) {
    return (
      (sorted[middle - 1] +
        sorted[middle]) /
      2
    );
  }

  return sorted[middle];
}

function standardDeviation(
  values: number[]
): number {
  if (values.length <= 1) {
    return 0;
  }

  const average =
    mean(values);

  const variance =
    sum(
      values.map(
        (value) =>
          Math.pow(
            value - average,
            2
          )
      )
    ) /
    (values.length - 1);

  return Math.sqrt(
    Math.max(
      0,
      variance
    )
  );
}

function safePercentage(
  numerator: number,
  denominator: number
): number | null {
  if (
    Math.abs(denominator) <=
    MONEY_TOLERANCE
  ) {
    return null;
  }

  return (
    (numerator /
      Math.abs(denominator)) *
    100
  );
}

function calculateZScore(
  confidenceLevel: number
): number {
  /*
   * Normal-distribution approximation.
   *
   * The coefficients below provide sufficient accuracy
   * for the confidence levels exposed by this service.
   */
  if (confidenceLevel >= 0.995) {
    return 2.807;
  }

  if (confidenceLevel >= 0.99) {
    return 2.576;
  }

  if (confidenceLevel >= 0.975) {
    return 2.241;
  }

  if (confidenceLevel >= 0.95) {
    return 1.96;
  }

  if (confidenceLevel >= 0.90) {
    return 1.645;
  }

  if (confidenceLevel >= 0.80) {
    return 1.282;
  }

  return 1.0;
}

function linearRegression(
  values: number[]
): RegressionResult {
  if (values.length < 2) {
    return {
      intercept:
        values[0] ?? 0,

      slope: 0,

      fitted:
        values.map(
          () => values[0] ?? 0
        ),

      residuals:
        values.map(
          () => 0
        ),

      rmse: 0,

      rSquared: 0,
    };
  }

  const n =
    values.length;

  const x =
    Array.from(
      { length: n },
      (_, index) =>
        index
    );

  const xMean =
    mean(x);

  const yMean =
    mean(values);

  const numerator =
    sum(
      x.map(
        (value, index) =>
          (value - xMean) *
          (values[index] -
            yMean)
      )
    );

  const denominator =
    sum(
      x.map(
        (value) =>
          Math.pow(
            value - xMean,
            2
          )
      )
    );

  const slope =
    Math.abs(denominator) >
    Number.EPSILON
      ? numerator /
        denominator
      : 0;

  const intercept =
    yMean -
    slope * xMean;

  const fitted =
    x.map(
      (value) =>
        intercept +
        slope * value
    );

  const residuals =
    values.map(
      (value, index) =>
        value -
        fitted[index]
    );

  const rmse =
    Math.sqrt(
      mean(
        residuals.map(
          (residual) =>
            residual *
            residual
        )
      )
    );

  const totalSumSquares =
    sum(
      values.map(
        (value) =>
          Math.pow(
            value - yMean,
            2
          )
      )
    );

  const residualSumSquares =
    sum(
      residuals.map(
        (residual) =>
          residual *
          residual
      )
    );

  const rSquared =
    totalSumSquares >
    MONEY_TOLERANCE
      ? clamp(
          1 -
            residualSumSquares /
              totalSumSquares,
          0,
          1
        )
      : 0;

  return {
    intercept,
    slope,
    fitted,
    residuals,
    rmse,
    rSquared,
  };
}

function detectSeasonality(
  values: number[]
): SeasonalityResult {
  /*
   * With fewer than 12 observations we do not claim
   * annual seasonality.
   */
  if (values.length < 12) {
    return {
      indexes:
        Array(12).fill(1),
      detected: false,
    };
  }

  const monthlyGroups =
    Array.from(
      { length: 12 },
      () => [] as number[]
    );

  for (
    let index = 0;
    index < values.length;
    index += 1
  ) {
    monthlyGroups[
      index % 12
    ].push(values[index]);
  }

  const overallMean =
    mean(values);

  if (
    Math.abs(overallMean) <=
    MONEY_TOLERANCE
  ) {
    return {
      indexes:
        Array(12).fill(1),
      detected: false,
    };
  }

  const indexes =
    monthlyGroups.map(
      (group) => {
        if (!group.length) {
          return 1;
        }

        return clamp(
          mean(group) /
            overallMean,
          0.25,
          4
        );
      }
    );

  const variation =
    standardDeviation(
      indexes
    );

  /*
   * A small deviation from 1.0 is not enough to call
   * the series seasonal.
   */
  const detected =
    variation >= 0.08;

  return {
    indexes,
    detected,
  };
}

function buildSeasonalTrendForecast(
  values: number[],
  forecastMonths: number,
  confidenceLevel: number
): MetricForecast {
  const regression =
    linearRegression(
      values
    );

  const seasonality =
    detectSeasonality(
      values
    );

  const zScore =
    calculateZScore(
      confidenceLevel
    );

  const residualStdDev =
    standardDeviation(
      regression.residuals
    );

  const baselineScale =
    Math.max(
      median(
        values.map(
          (value) =>
            Math.abs(value)
        )
      ),
      1
    );

  /*
   * Prevent extremely small historical values from
   * creating unstable percentage intervals.
   */
  const minimumUncertainty =
    baselineScale *
    0.02;

  const uncertainty =
    Math.max(
      residualStdDev,
      minimumUncertainty
    );

  const forecastValues: number[] = [];
  const lowerValues: number[] = [];
  const upperValues: number[] = [];

  for (
    let step = 1;
    step <= forecastMonths;
    step += 1
  ) {
    const timeIndex =
      values.length +
      step -
      1;

    const trendValue =
      regression.intercept +
      regression.slope *
        timeIndex;

    const seasonalIndex =
      seasonality.detected
        ? seasonality.indexes[
            timeIndex % 12
          ]
        : 1;

    /*
     * Apply seasonality to the trend component.
     */
    const forecastValue =
      Math.max(
        0,
        trendValue *
          seasonalIndex
      );

    /*
     * Forecast uncertainty grows with the horizon.
     */
    const horizonMultiplier =
      Math.sqrt(
        step
      );

    const interval =
      zScore *
      uncertainty *
      horizonMultiplier;

    const lower =
      Math.max(
        0,
        forecastValue -
          interval
      );

    const upper =
      Math.max(
        forecastValue,
        forecastValue +
          interval
      );

    forecastValues.push(
      roundMoney(
        forecastValue
      )
    );

    lowerValues.push(
      roundMoney(
        lower
      )
    );

    upperValues.push(
      roundMoney(
        upper
      )
    );
  }

  return {
    values:
      forecastValues,

    lower:
      lowerValues,

    upper:
      upperValues,

    regression,

    seasonality,
  };
}

function calculateAccuracy(
  metric: ForecastMetric,
  values: number[]
): ForecastAccuracy {
  if (
    values.length <
    3
  ) {
    return {
      metric,
      meanAbsoluteError: 0,
      meanAbsolutePercentageError:
        null,
      rootMeanSquareError: 0,
      observations:
        values.length,
    };
  }

  /*
   * Rolling one-step backtest.
   *
   * Each observation is predicted from the history that
   * existed before it. This gives the service a meaningful
   * internal accuracy signal without using future values
   * to evaluate earlier observations.
   */
  const actual: number[] = [];
  const predicted: number[] = [];

  const minimumTraining =
    Math.max(
      3,
      Math.min(
        MIN_TRAINING_MONTHS,
        values.length - 1
      )
    );

  for (
    let index =
      minimumTraining;
    index <
    values.length;
    index += 1
  ) {
    const training =
      values.slice(
        0,
        index
      );

    const regression =
      linearRegression(
        training
      );

    const seasonality =
      detectSeasonality(
        training
      );

    const timeIndex =
      training.length;

    const trendValue =
      regression.intercept +
      regression.slope *
        timeIndex;

    const seasonalIndex =
      seasonality.detected
        ? seasonality.indexes[
            timeIndex % 12
          ]
        : 1;

    const prediction =
      Math.max(
        0,
        trendValue *
          seasonalIndex
      );

    predicted.push(
      prediction
    );

    actual.push(
      Math.max(
        0,
        values[index]
      )
    );
  }

  if (!actual.length) {
    return {
      metric,
      meanAbsoluteError: 0,
      meanAbsolutePercentageError:
        null,
      rootMeanSquareError: 0,
      observations: 0,
    };
  }

  const absoluteErrors =
    actual.map(
      (value, index) =>
        Math.abs(
          value -
            predicted[index]
        )
    );

  const squaredErrors =
    actual.map(
      (value, index) =>
        Math.pow(
          value -
            predicted[index],
          2
        )
    );

  const percentageErrors =
    actual
      .map(
        (value, index) => {
          if (
            Math.abs(value) <=
            MONEY_TOLERANCE
          ) {
            return null;
          }

          return (
            Math.abs(
              value -
                predicted[index]
            ) /
            Math.abs(value)
          ) * 100;
        }
      )
      .filter(
        (
          value
        ): value is number =>
          value !== null
      );

  return {
    metric,

    meanAbsoluteError:
      roundMoney(
        mean(
          absoluteErrors
        )
      ),

    meanAbsolutePercentageError:
      percentageErrors.length
        ? roundMoney(
            mean(
              percentageErrors
            )
          )
        : null,

    rootMeanSquareError:
      roundMoney(
        Math.sqrt(
          mean(
            squaredErrors
          )
        )
      ),

    observations:
      actual.length,
  };
}

function calculateTrendStrength(
  regression: RegressionResult,
  values: number[]
): number {
  if (!values.length) {
    return 0;
  }

  const average =
    mean(
      values.map(
        (value) =>
          Math.abs(value)
      )
    );

  if (
    average <=
    MONEY_TOLERANCE
  ) {
    return 0;
  }

  /*
   * Normalize slope against the historical average.
   */
  const normalizedSlope =
    Math.abs(
      regression.slope
    ) / average;

  return clamp(
    normalizedSlope,
    0,
    1
  );
}

function getMetricValues(
  features: ForecastFeatureRow[],
  metric: ForecastMetric
): number[] {
  return features.map(
    (row) => {
      switch (metric) {
        case "REVENUE":
          return Math.max(
            0,
            row.revenue
          );

        case "EXPENSES":
          return Math.max(
            0,
            row.expenses
          );

        case "NET_PROFIT":
          /*
           * Net profit can legitimately be negative.
           */
          return row.netProfit;

        default:
          return 0;
      }
    }
  );
}

function createFutureMonth(
  lastMonth: string,
  offset: number
): {
  month: string;
  year: number;
  monthNumber: number;
} {
  const [yearString, monthString] =
    lastMonth.split("-");

  const year =
    Number(yearString);

  const month =
    Number(monthString);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1 + offset,
        1
      )
    );

  return {
    month:
      `${date.getUTCFullYear()}-${String(
        date.getUTCMonth() + 1
      ).padStart(2, "0")}`,

    year:
      date.getUTCFullYear(),

    monthNumber:
      date.getUTCMonth() + 1,
  };
}

function ensureDatasetIsValid(
  dataset: FinancialDataset
): void {
  if (!dataset) {
    throw new Error(
      "FORECAST_FINANCIAL_DATA_REQUIRED"
    );
  }

  if (
    !dataset.organizationId?.trim()
  ) {
    throw new Error(
      "FORECAST_ORGANIZATION_REQUIRED"
    );
  }

  if (
    !Array.isArray(
      dataset.months
    )
  ) {
    throw new Error(
      "FORECAST_INVALID_FINANCIAL_DATA"
    );
  }
}

function buildReadiness(
  dataset: FinancialDataset
): {
  status: ForecastReadiness;
  message: string;
} {
  ensureDatasetIsValid(
    dataset
  );

  if (
    dataset.readiness.status ===
    "NOT_READY"
  ) {
    return {
      status: "NOT_READY",
      message:
        dataset.readiness.message,
    };
  }

  if (
    dataset.readiness.status ===
    "INSUFFICIENT_DATA"
  ) {
    return {
      status:
        "INSUFFICIENT_DATA",
      message:
        dataset.readiness.message,
    };
  }

  if (
    dataset.months.length <
    MIN_TRAINING_MONTHS
  ) {
    return {
      status:
        "INSUFFICIENT_DATA",
      message:
        `At least ${MIN_TRAINING_MONTHS} months of financial history are required for forecasting.`,
    };
  }

  return {
    status: "READY",
    message:
      "Financial history is sufficient for forecasting.",
  };
}

function buildWarnings(
  dataset: FinancialDataset,
  features: ForecastFeatureRow[]
): string[] {
  const warnings: string[] = [];

  const activeMonths =
    features.filter(
      (row) =>
        row.transactionCount >
        0
    ).length;

  if (
    activeMonths <
    MIN_TRAINING_MONTHS
  ) {
    warnings.push(
      `Only ${activeMonths} active financial months are available.`
    );
  }

  const zeroRevenueMonths =
    features.filter(
      (row) =>
        Math.abs(
          row.revenue
        ) <= MONEY_TOLERANCE
    ).length;

  if (
    zeroRevenueMonths >
    Math.floor(
      features.length / 2
    )
  ) {
    warnings.push(
      "More than half of the historical months have no recorded revenue."
    );
  }

  const zeroExpenseMonths =
    features.filter(
      (row) =>
        Math.abs(
          row.expenses
        ) <= MONEY_TOLERANCE
    ).length;

  if (
    zeroExpenseMonths >
    Math.floor(
      features.length / 2
    )
  ) {
    warnings.push(
      "More than half of the historical months have no recorded expenses."
    );
  }

  const latest =
    features[
      features.length - 1
    ];

  if (
    latest &&
    latest.transactionCount ===
      0
  ) {
    warnings.push(
      "The latest historical month has no accounting transactions and may be incomplete."
    );
  }

  if (
    dataset.readiness.status !==
    "READY"
  ) {
    warnings.push(
      dataset.readiness.message
    );
  }

  return warnings;
}

function buildForecast(
  dataset: FinancialDataset,
  features: ForecastFeatureRow[],
  forecastMonths: number,
  confidenceLevel: number
): FinancialForecast {
  const readiness =
    buildReadiness(
      dataset
    );

  if (
    readiness.status !==
    "READY"
  ) {
    return {
      organizationId:
        dataset.organizationId,

      currency:
        dataset.currency,

      generatedAt:
        new Date().toISOString(),

      historicalPeriod: {
        startDate:
          dataset.startDate,

        endDate:
          dataset.endDate,

        observations:
          features.length,
      },

      forecastPeriod: {
        startMonth:
          "",
        endMonth:
          "",
        months:
          0,
      },

      readiness,

      model: {
        name:
          "INSUFFICIENT_DATA",
        version:
          "1.0.0",
      },

      forecast: [],

      totals: {
        historicalRevenue:
          roundMoney(
            dataset.totals
              .revenue
          ),

        historicalExpenses:
          roundMoney(
            dataset.totals
              .expenses
          ),

        historicalNetProfit:
          roundMoney(
            dataset.totals
              .netProfit
          ),

        forecastRevenue:
          0,

        forecastExpenses:
          0,

        forecastNetProfit:
          0,
      },

      diagnostics: {
        model:
          "INSUFFICIENT_DATA",

        trainingMonths:
          features.length,

        forecastMonths:
          0,

        confidenceLevel,

        trendStrength: {
          revenue: 0,
          expenses: 0,
          netProfit: 0,
        },

        seasonalityDetected: {
          revenue: false,
          expenses: false,
          netProfit: false,
        },

        accuracy: [],

        warnings:
          buildWarnings(
            dataset,
            features
          ),
      },
    };
  }

  const revenueValues =
    getMetricValues(
      features,
      "REVENUE"
    );

  const expenseValues =
    getMetricValues(
      features,
      "EXPENSES"
    );

  const profitValues =
    getMetricValues(
      features,
      "NET_PROFIT"
    );

  const revenueForecast =
    buildSeasonalTrendForecast(
      revenueValues,
      forecastMonths,
      confidenceLevel
    );

  const expenseForecast =
    buildSeasonalTrendForecast(
      expenseValues,
      forecastMonths,
      confidenceLevel
    );

  const profitForecast =
    buildSeasonalTrendForecast(
      profitValues,
      forecastMonths,
      confidenceLevel
    );

  const lastHistoricalMonth =
    features[
      features.length - 1
    ].month;

  const forecast: ForecastPoint[] =
    [];

  for (
    let index = 0;
    index < forecastMonths;
    index += 1
  ) {
    const future =
      createFutureMonth(
        lastHistoricalMonth,
        index + 1
      );

    const revenue =
      revenueForecast.values[
        index
      ];

    const expenses =
      expenseForecast.values[
        index
      ];

    /*
     * Net profit is always reconciled to the forecast
     * revenue and expense values instead of independently
     * trusting three separate model outputs.
     */
    const netProfit =
      roundMoney(
        revenue -
          expenses
      );

    const revenueLower =
      revenueForecast.lower[
        index
      ];

    const revenueUpper =
      revenueForecast.upper[
        index
      ];

    const expensesLower =
      expenseForecast.lower[
        index
      ];

    const expensesUpper =
      expenseForecast.upper[
        index
      ];

    /*
     * The net-profit interval is derived from the
     * independently calculated revenue/expense intervals.
     */
    const netProfitLower =
      roundMoney(
        revenueLower -
          expensesUpper
      );

    const netProfitUpper =
      roundMoney(
        revenueUpper -
          expensesLower
      );

    forecast.push({
      month:
        future.month,

      year:
        future.year,

      monthNumber:
        future.monthNumber,

      revenue:
        roundMoney(
          revenue
        ),

      expenses:
        roundMoney(
          expenses
        ),

      netProfit,

      revenueLower:
        roundMoney(
          revenueLower
        ),

      revenueUpper:
        roundMoney(
          revenueUpper
        ),

      expensesLower:
        roundMoney(
          expensesLower
        ),

      expensesUpper:
        roundMoney(
          expensesUpper
        ),

      netProfitLower:
        Math.min(
          netProfitLower,
          netProfitUpper
        ),

      netProfitUpper:
        Math.max(
          netProfitLower,
          netProfitUpper
        ),
    });
  }

  const forecastRevenue =
    roundMoney(
      sum(
        forecast.map(
          (row) =>
            row.revenue
        )
      )
    );

  const forecastExpenses =
    roundMoney(
      sum(
        forecast.map(
          (row) =>
            row.expenses
        )
      )
    );

  const forecastNetProfit =
    roundMoney(
      forecastRevenue -
        forecastExpenses
    );

  const accuracy: ForecastAccuracy[] =
    [
      calculateAccuracy(
        "REVENUE",
        revenueValues
      ),

      calculateAccuracy(
        "EXPENSES",
        expenseValues
      ),

      calculateAccuracy(
        "NET_PROFIT",
        profitValues
      ),
    ];

  const warnings =
    buildWarnings(
      dataset,
      features
    );

  if (
    revenueForecast.regression.rSquared <
    0.25
  ) {
    warnings.push(
      "Revenue trend has low explanatory strength. Revenue forecasts should be interpreted cautiously."
    );
  }

  if (
    expenseForecast.regression.rSquared <
    0.25
  ) {
    warnings.push(
      "Expense trend has low explanatory strength. Expense forecasts should be interpreted cautiously."
    );
  }

  if (
    profitForecast.regression.rSquared <
    0.25
  ) {
    warnings.push(
      "Net-profit trend has low explanatory strength. Net-profit forecasts should be interpreted cautiously."
    );
  }

  return {
    organizationId:
      dataset.organizationId,

    currency:
      dataset.currency,

    generatedAt:
      new Date().toISOString(),

    historicalPeriod: {
      startDate:
        dataset.startDate,

      endDate:
        dataset.endDate,

      observations:
        features.length,
    },

    forecastPeriod: {
      startMonth:
        forecast[0]?.month ??
        "",

      endMonth:
        forecast[
          forecast.length - 1
        ]?.month ?? "",

      months:
        forecast.length,
    },

    readiness,

    model: {
      name:
        "TREND_SEASONALITY",

      version:
        "1.0.0",
    },

    forecast,

    totals: {
      historicalRevenue:
        roundMoney(
          dataset.totals
            .revenue
        ),

      historicalExpenses:
        roundMoney(
          dataset.totals
            .expenses
        ),

      historicalNetProfit:
        roundMoney(
          dataset.totals
            .netProfit
        ),

      forecastRevenue,

      forecastExpenses,

      forecastNetProfit,
    },

    diagnostics: {
      model:
        "TREND_SEASONALITY",

      trainingMonths:
        features.length,

      forecastMonths:
        forecast.length,

      confidenceLevel,

      trendStrength: {
        revenue:
          calculateTrendStrength(
            revenueForecast.regression,
            revenueValues
          ),

        expenses:
          calculateTrendStrength(
            expenseForecast.regression,
            expenseValues
          ),

        netProfit:
          calculateTrendStrength(
            profitForecast.regression,
            profitValues
          ),
      },

      seasonalityDetected: {
        revenue:
          revenueForecast
            .seasonality
            .detected,

        expenses:
          expenseForecast
            .seasonality
            .detected,

        netProfit:
          profitForecast
            .seasonality
            .detected,
      },

      accuracy,

      warnings,
    },
  };
}

/**
 * Generate a financial forecast for exactly one tenant.
 *
 * This is the main service entry point.
 *
 * No tenant may be inferred here.
 * The caller must explicitly provide organizationId.
 */
export async function generateFinancialForecast(
  organizationIdInput: string,
  options?: {
    historyMonths?: number;
    forecastMonths?: number;
    endDate?: Date | string;
    confidenceLevel?: number;
    completedMonthsOnly?: boolean;
  }
): Promise<FinancialForecast> {
  const organizationId =
    normalizeOrganizationId(
      organizationIdInput
    );

  const historyMonths =
    parsePositiveInteger(
      options?.historyMonths,
      DEFAULT_HISTORY_MONTHS,
      MAX_HISTORY_MONTHS,
      "FORECAST_INVALID_HISTORY_MONTHS"
    );

  const forecastMonths =
    parsePositiveInteger(
      options?.forecastMonths,
      DEFAULT_FORECAST_MONTHS,
      MAX_FORECAST_MONTHS,
      "FORECAST_INVALID_FORECAST_MONTHS"
    );

  const confidenceLevel =
    normalizeConfidence(
      options?.confidenceLevel
    );

  const dataset =
    options?.completedMonthsOnly
      ? await import(
          "./financialData.service"
        ).then(
          ({
            getCompletedFinancialHistory,
          }) =>
            getCompletedFinancialHistory(
              organizationId,
              historyMonths
            )
        )
      : await getForecastDataset(
          organizationId,
          {
            months:
              historyMonths,

            endDate:
              options?.endDate,

            completedMonthsOnly:
              false,
          }
        );

  ensureDatasetIsValid(
    dataset
  );

  const features =
    "features" in dataset &&
    Array.isArray(
      dataset.features
    )
      ? dataset.features
      : buildForecastFeatures(
          dataset
        );

  return buildForecast(
    dataset,
    features,
    forecastMonths,
    confidenceLevel
  );
}

/**
 * Generate a forecast using completed months only.
 *
 * This is the preferred production mode for scheduled
 * forecasting because the current month may still be
 * incomplete.
 */
export async function generateCompletedMonthForecast(
  organizationIdInput: string,
  options?: {
    historyMonths?: number;
    forecastMonths?: number;
    confidenceLevel?: number;
  }
): Promise<FinancialForecast> {
  return generateFinancialForecast(
    organizationIdInput,
    {
      historyMonths:
        options?.historyMonths ??
        DEFAULT_HISTORY_MONTHS,

      forecastMonths:
        options?.forecastMonths ??
        DEFAULT_FORECAST_MONTHS,

      confidenceLevel:
        options?.confidenceLevel,

      completedMonthsOnly:
        true,
    }
  );
}

/**
 * Generate forecasts for all three core financial
 * metrics independently while maintaining accounting
 * reconciliation for net profit.
 */
export async function generateCoreFinancialForecast(
  organizationIdInput: string,
  options?: {
    historyMonths?: number;
    forecastMonths?: number;
    endDate?: Date | string;
    confidenceLevel?: number;
    completedMonthsOnly?: boolean;
  }
): Promise<FinancialForecast> {
  return generateFinancialForecast(
    organizationIdInput,
    options
  );
}

/**
 * Lightweight readiness API for controllers.
 *
 * The forecasting controller can use this before requesting
 * the full dataset when it only needs to know whether
 * forecasting is possible.
 */
export async function getForecastReadiness(
  organizationIdInput: string,
  options?: {
    historyMonths?: number;
    endDate?: Date | string;
  }
): Promise<{
  organizationId: string;
  status: ForecastReadiness;
  minimumTrainingMonths: number;
  requestedHistoryMonths: number;
  message: string;
}> {
  const organizationId =
    normalizeOrganizationId(
      organizationIdInput
    );

  const historyMonths =
    parsePositiveInteger(
      options?.historyMonths,
      DEFAULT_HISTORY_MONTHS,
      MAX_HISTORY_MONTHS,
      "FORECAST_INVALID_HISTORY_MONTHS"
    );

  const dataset =
    await getForecastDataset(
      organizationId,
      {
        months:
          historyMonths,

        endDate:
          options?.endDate,

        completedMonthsOnly:
          false,
      }
    );

  const readiness =
    buildReadiness(
      dataset
    );

  return {
    organizationId,

    status:
      readiness.status,

    minimumTrainingMonths:
      MIN_TRAINING_MONTHS,

    requestedHistoryMonths:
      historyMonths,

    message:
      readiness.message,
  };
}

/**
 * Configuration is exported so controllers and future
 * AI modules do not duplicate forecasting limits.
 */
export const FORECASTING_CONFIG = {
  model:
    "TREND_SEASONALITY",

  modelVersion:
    "1.0.0",

  minimumTrainingMonths:
    MIN_TRAINING_MONTHS,

  defaultHistoryMonths:
    DEFAULT_HISTORY_MONTHS,

  maximumHistoryMonths:
    MAX_HISTORY_MONTHS,

  defaultForecastMonths:
    DEFAULT_FORECAST_MONTHS,

  maximumForecastMonths:
    MAX_FORECAST_MONTHS,

  defaultConfidenceLevel:
    0.95,

  minimumConfidence:
    MIN_CONFIDENCE,

  maximumConfidence:
    MAX_CONFIDENCE,

  currency:
    "KES",

  tenantIsolation:
    "ORGANIZATION_SCOPED",

  accountingSource:
    "JournalEntryLine",

  effectiveJournalStatuses: [
    "POSTED",
    "APPROVED",
  ] as const,
} as const;