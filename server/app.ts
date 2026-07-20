import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes";
import protectedRoutes from "./routes/protected.routes";
import userRoutes from "./routes/user.routes";

import accountRoutes from "./routes/account.routes";
import journalRoutes from "./routes/journal.routes";
import ledgerRoutes from "./routes/ledger.routes";
import trialBalanceRoutes from "./routes/trialbalance.routes";
import incomeStatementRoutes from "./routes/incomeStatement.routes";
import balanceSheetRoutes from "./routes/balanceSheet.routes";
import cashFlowRoutes from "./routes/cashFlow.routes";

import accountsReceivableRoutes from "./routes/accountsReceivable.routes";
import accountsPayableRoutes from "./routes/accountsPayable.routes";
import vendorRoutes from "./routes/vendor.routes";
import expenseRoutes from "./routes/expense.routes";
import bankAccountRoutes from "./routes/bankAccount.routes";
import invoiceRoutes from "./routes/invoice.routes";
import mpesaRoutes from "./routes/mpesa.routes";
import portfolioCompanyRoutes from "./routes/portfolioCompany.routes";
import investmentRoutes from "./routes/investment.routes";

const app = express();

/*
|--------------------------------------------------------------------------
| Global Middleware
|--------------------------------------------------------------------------
*/

app.use(cors());
app.use(express.json());

/*
|--------------------------------------------------------------------------
| Authentication
|--------------------------------------------------------------------------
*/

app.use("/api/auth", authRoutes);

/*
|--------------------------------------------------------------------------
| Protected Routes
|--------------------------------------------------------------------------
*/

app.use("/api", protectedRoutes);

/*
|--------------------------------------------------------------------------
| User Management
|--------------------------------------------------------------------------
*/

app.use("/api/users", userRoutes);

/*
|--------------------------------------------------------------------------
| Core Financial Engine
|--------------------------------------------------------------------------
*/

app.use("/api/accounts", accountRoutes);
app.use("/api/journals", journalRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/trial-balance", trialBalanceRoutes);
app.use("/api/income-statement", incomeStatementRoutes);
app.use("/api/balance-sheet", balanceSheetRoutes);
app.use("/api/cash-flow", cashFlowRoutes);

/*
|--------------------------------------------------------------------------
| Business Operations
|--------------------------------------------------------------------------
*/

app.use("/api/accounts-receivable", accountsReceivableRoutes);

app.use("/api/accounts-payable", accountsPayableRoutes);

app.use("/api/vendors", vendorRoutes);

app.use("/api/expenses", expenseRoutes);

app.use("/api/bank-accounts", bankAccountRoutes);

app.use("/api/invoices", invoiceRoutes);

app.use("/api/mpesa", mpesaRoutes);

app.use("/api/portfolio-companies", portfolioCompanyRoutes);

app.use("/api/investments", investmentRoutes);

/*
|--------------------------------------------------------------------------
| Upcoming Modules
|--------------------------------------------------------------------------
|
| These modules will be implemented in the next phases of Ziya FOS.
|
*/

//
// app.use("/api/customers", customerRoutes);
// app.use("/api/procurement", procurementRoutes);
// app.use("/api/assets", assetRoutes);
// app.use("/api/budgets", budgetRoutes);
// app.use("/api/hr", hrRoutes);
// app.use("/api/payroll", payrollRoutes);
// app.use("/api/tax", taxRoutes);
// app.use("/api/forecasting", forecastingRoutes);
// app.use("/api/ai-assistant", aiAssistantRoutes);
//

export default app;