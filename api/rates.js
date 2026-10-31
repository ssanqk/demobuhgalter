// Офіційний курс НБУ для USD, EUR, PLN.
//   GET /api/rates              → курс на сьогодні
//   GET /api/rates?date=2026-10-01 → курс на конкретну дату
// Відповідь: { date: "2026-10-29", rates: { USD, EUR, PLN }, source: "НБУ" }

const WANT = ["USD", "EUR", "PLN"];

module.exports = async (req, res) => {
  const q = req.query || {};
  const date = String(q.date || "").replace(/-/g, "");
  let url = "https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json";
  if (/^\d{8}$/.test(date)) url += `&date=${date}`;

  try {
    const r = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "hryvnevyi-balans/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`NBU HTTP ${r.status}`);
    const list = await r.json();

    const rates = {};
    let exDate = "";
    for (const row of Array.isArray(list) ? list : []) {
      if (WANT.includes(row.cc) && Number(row.rate) > 0) {
        rates[row.cc] = Number(row.rate);
        exDate = exDate || String(row.exchangedate || "");
      }
    }
    if (WANT.some((c) => !rates[c])) throw new Error("NBU: немає потрібних валют");

    const [d, m, y] = exDate.split(".");
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
    res.status(200).json({ date: y && m && d ? `${y}-${m}-${d}` : "", rates, source: "НБУ" });
  } catch (e) {
    console.error(e);
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: "nbu_unavailable" });
  }
};
