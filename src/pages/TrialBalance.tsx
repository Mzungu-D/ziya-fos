const trialBalance = [
  {
    account: "Cash and Bank",
    debit: "KES 12,456,700",
    credit: "-",
  },
  {
    account: "Loans Receivable",
    debit: "KES 35,000,000",
    credit: "-",
  },
  {
    account: "Accounts Payable",
    debit: "-",
    credit: "KES 5,500,000",
  },
  {
    account: "Revenue",
    debit: "-",
    credit: "KES 45,678,900",
  },
  {
    account: "Operating Expenses",
    debit: "KES 25,340,500",
    credit: "-",
  },
];

export default function TrialBalance() {
  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-3xl font-bold text-white">
          Trial Balance
        </h1>

        <p className="text-slate-400 mt-2">
          Verify that total debits equal total credits.
        </p>
      </div>

      <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="text-left p-4">Account</th>
              <th className="text-right p-4">Debit</th>
              <th className="text-right p-4">Credit</th>
            </tr>
          </thead>

          <tbody>
            {trialBalance.map((item) => (
              <tr
                key={item.account}
                className="border-t border-slate-800 hover:bg-slate-900"
              >
                <td className="p-4 text-white">
                  {item.account}
                </td>

                <td className="p-4 text-right text-green-400">
                  {item.debit}
                </td>

                <td className="p-4 text-right text-red-400">
                  {item.credit}
                </td>
              </tr>
            ))}

            <tr className="border-t border-slate-700 font-bold">
              <td className="p-4 text-white">
                TOTAL
              </td>

              <td className="p-4 text-right text-green-400">
                KES 72,797,200
              </td>

              <td className="p-4 text-right text-red-400">
                KES 51,178,900
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-red-500/10 border border-red-500 rounded-xl p-4">
        <p className="text-red-400 font-semibold">
          Trial Balance Out Of Balance
        </p>

        <p className="text-slate-300 mt-1">
          Difference: KES 21,618,300
        </p>
      </div>

    </div>
  );
}