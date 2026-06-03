import Link from "next/link";
import { loadSignalsPageData } from "@/lib/signals-page";

export const dynamic = "force-dynamic";

function calcPeg(pe?: number | null, profitYoyPct?: number | null) {
  if (pe == null || profitYoyPct == null || pe <= 0 || profitYoyPct <= 0) {
    return null;
  }
  return pe / profitYoyPct;
}

export default async function SignalsPage() {
  let rows: Awaited<ReturnType<typeof loadSignalsPageData>>["rows"] = [];
  let error: string | null = null;
  let fallbackSnapshotGeneratedAt: string | null = null;
  try {
    const data = await loadSignalsPageData();
    rows = data.rows;
    fallbackSnapshotGeneratedAt = data.fallbackSnapshotGeneratedAt;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="container">
      <Link href="/" className="back-link">返回股票池</Link>
      <header className="page-header compact">
        <div>
          <div className="eyebrow">Live scoring</div>
          <h1>实时信号</h1>
          <p>以 PEG 和利润增速/估值匹配为主，短期价格指标降权，生成 5-20 个交易日动作建议。</p>
        </div>
      </header>
      {error && (
        <div className="card" style={{ borderColor: "var(--danger)" }}>
          <strong>加载失败：</strong> {error}
          <p style={{ color: "var(--muted)" }}>
            请确认 pyserver 运行在 <code>{process.env.PYSERVER_URL ?? "http://localhost:8001"}</code>，
            且 <code>DEEPSEEK_API_KEY</code> 已配置。
          </p>
        </div>
      )}
      {!error && (
        <div className="theme-panel">
          {fallbackSnapshotGeneratedAt && (
            <div className="card" style={{ marginBottom: 12, borderColor: "var(--warn)" }}>
              <strong>快照回退：</strong> 当前展示的是最近一次成功结果，
              生成时间 <code>{fallbackSnapshotGeneratedAt}</code>。
            </div>
          )}
          <div className="theme-title">
            <strong>信号列表</strong>
            <span>{rows.filter((r) => r.signal?.action === "buy").length} 买入 · {rows.filter((r) => r.signal?.action === "sell").length} 卖出</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>代码</th>
                  <th>名称</th>
                  <th>主题</th>
                  <th>动作</th>
                  <th className="num">现价</th>
                  <th className="num">置信度</th>
                  <th className="num">仓位</th>
                  <th className="num">PE(TTM)</th>
                  <th className="num">利润同比</th>
                  <th className="num">PEG</th>
                  <th>理由</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ entry, signal, snapshot }) => (
                  <tr key={entry.symbol}>
                    <td className="mono">{entry.symbol}</td>
                    <td>{entry.name}</td>
                    <td>{entry.theme}</td>
                    <td>
                      {signal ? (
                        <span className={`badge ${signal.action}`}>{signal.action}</span>
                      ) : (
                        <span className="badge">n/a</span>
                      )}
                    </td>
                    <td className="num">{snapshot?.spotPrice?.toFixed(2) ?? snapshot?.lastClose?.toFixed(2) ?? "—"}</td>
                    <td className="num">{signal ? (signal.confidence * 100).toFixed(0) + "%" : "—"}</td>
                    <td className="num">{signal ? (signal.size * 100).toFixed(0) + "%" : "—"}</td>
                    <td className="num">{snapshot?.fundamental?.pe_ttm?.toFixed(1) ?? "—"}</td>
                    <td className="num">{snapshot?.fundamental?.profit_yoy != null ? `${snapshot.fundamental.profit_yoy.toFixed(1)}%` : "—"}</td>
                    <td className="num">{calcPeg(snapshot?.fundamental?.pe_ttm, snapshot?.fundamental?.profit_yoy)?.toFixed(2) ?? "—"}</td>
                    <td className="muted signal-reason">{signal?.rationale ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
