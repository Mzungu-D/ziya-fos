import { DollarSign, TrendingUp, Wallet, Landmark } from "lucide-react";

const cards = [
  {
    title:  "Total Revenue",
    value:  "KES 45,678,900",
    change: "+12.5%",
    period: "vs last month",
    color:  "text-[#20243A]",
    bg:     "bg-[#20243A]/10",
    icon:   DollarSign,
  },
  {
    title:  "Total Expenses",
    value:  "KES 25,340,500",
    change: "+8.1%",
    period: "vs last month",
    color:  "text-[#EF4444]",
    bg:     "bg-[#EF4444]/10",
    icon:   Wallet,
  },
  {
    title:  "Net Profit",
    value:  "KES 20,338,400",
    change: "+18.7%",
    period: "vs last month",
    color:  "text-[#16A34A]",
    bg:     "bg-[#16A34A]/10",
    icon:   TrendingUp,
  },
  {
    title:  "Cash Balance",
    value:  "KES 12,456,700",
    change: "+5.3%",
    period: "vs last month",
    color:  "text-[#F59E0B]",
    bg:     "bg-[#F59E0B]/10",
    icon:   Landmark,
  },
];

export default function KPICards() {
  return (
    <div className="grid grid-cols-4 gap-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="bg-white border border-[#ECECF3] rounded-2xl p-5 hover:border-[#20243A]/40 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-11 h-11 rounded-xl ${card.bg} flex items-center justify-center`}>
                <Icon className={card.color} size={20} />
              </div>
            </div>

            <p className="text-[#666B84] text-sm">{card.title}</p>

            <h2 className="text-2xl font-bold text-[#20243A] mt-2">{card.value}</h2>

            <div className="flex items-center gap-2 mt-3 text-sm">
              <span className={card.color}>{card.change}</span>
              <span className="text-[#666B84]">{card.period}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
