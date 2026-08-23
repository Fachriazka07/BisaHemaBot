import { getMonthlyExpenseByCategory } from './report.service';

// ─────────────────────────────────────────────────────────
// CHART SERVICE — Generate chart via quickchart.io
// ─────────────────────────────────────────────────────────

const QUICKCHART_URL = 'https://quickchart.io/chart';

const COLORS = [
  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
  '#FF9F40', '#C9CBCF', '#7BC8A4', '#E7E9ED', '#FF6B6B',
];

/** Generate pie chart URL for expense by category (this month) */
export async function getExpensePieChartUrl(userId: number): Promise<string | null> {
  const data = await getMonthlyExpenseByCategory(userId);
  if (data.length === 0) return null;

  const labels = data.map((d) => `${d.emoji} ${d.name}`);
  const amounts = data.map((d) => d.amount);
  const colors = data.map((_, i) => COLORS[i % COLORS.length]);

  const chartConfig = {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: amounts,
        backgroundColor: colors,
      }],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Pengeluaran Bulan Ini',
          font: { size: 18 },
        },
        datalabels: {
          display: true,
          formatter: (value: number, ctx: { chart: { data: { datasets: Array<{ data: number[] }> } } }) => {
            const total = ctx.chart.data.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
            const pct = Math.round((value / total) * 100);
            return `${pct}%`;
          },
          color: '#fff',
          font: { size: 14, weight: 'bold' },
        },
      },
    },
  };

  const params = new URLSearchParams({
    c: JSON.stringify(chartConfig),
    w: '500',
    h: '400',
    backgroundColor: 'white',
  });

  return `${QUICKCHART_URL}?${params.toString()}`;
}

/** Generate bar chart URL comparing income vs expense (this month) */
export async function getIncomeVsExpenseBarUrl(userId: number): Promise<string | null> {
  const data = await getMonthlyExpenseByCategory(userId);
  if (data.length === 0) return null;

  const labels = data.map((d) => `${d.emoji} ${d.name}`);
  const amounts = data.map((d) => d.amount);

  const chartConfig = {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Pengeluaran (Rp)',
        data: amounts,
        backgroundColor: '#FF6384',
      }],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Breakdown Pengeluaran Bulan Ini',
          font: { size: 18 },
        },
      },
      scales: {
        y: { beginAtZero: true },
      },
    },
  };

  const params = new URLSearchParams({
    c: JSON.stringify(chartConfig),
    w: '600',
    h: '400',
    backgroundColor: 'white',
  });

  return `${QUICKCHART_URL}?${params.toString()}`;
}
