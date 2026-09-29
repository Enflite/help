// Flowcharts drawn in the brand style (content blocks { "t": "flowchart", "name": ... }).
const CHARTS = {
  // QA-300-037 section 6: which record a problem becomes.
  "mrr-cmr-trr": (
    <svg className="flow" viewBox="0 0 560 330" role="img"
      aria-label="Flowchart: Problem Identified, then Inventory Transaction? Yes: Create MRR. No: Production Technician Error? Yes: Create TRR. No: Create CMR (eCMRs).">
      <defs>
        <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0L10,5L0,10z" fill="#1A1A1A" />
        </marker>
      </defs>
      <g fill="none" stroke="#1A1A1A" strokeWidth="1">
        <rect x="10" y="30" width="120" height="70" />
        <path d="M255,20 L315,65 L255,110 L195,65 Z" />
        <rect x="395" y="45" width="140" height="40" rx="20" />
        <path d="M255,155 L315,200 L255,245 L195,200 Z" />
        <rect x="395" y="180" width="140" height="40" rx="20" stroke="#CF0C2C" strokeWidth="1.5" />
        <rect x="185" y="285" width="140" height="40" rx="20" />
        <path d="M130,65 H193" markerEnd="url(#ar)" />
        <path d="M315,65 H393" markerEnd="url(#ar)" />
        <path d="M255,110 V153" markerEnd="url(#ar)" />
        <path d="M315,200 H393" markerEnd="url(#ar)" />
        <path d="M255,245 V283" markerEnd="url(#ar)" />
      </g>
      <text x="70" y="69" textAnchor="middle">Problem Identified</text>
      <text x="255" y="61" textAnchor="middle">Inventory</text>
      <text x="255" y="76" textAnchor="middle">Transaction?</text>
      <text x="465" y="69" textAnchor="middle">Create MRR</text>
      <text x="255" y="189" textAnchor="middle">Production</text>
      <text x="255" y="204" textAnchor="middle">Technician</text>
      <text x="255" y="219" textAnchor="middle">Error?</text>
      <text x="465" y="197" textAnchor="middle">Create CMR</text>
      <text x="465" y="212" textAnchor="middle" fontSize="11">(eCMRs)</text>
      <text x="255" y="309" textAnchor="middle">Create TRR</text>
      <text x="352" y="59" textAnchor="middle" fontSize="11">YES</text>
      <text x="262" y="137" fontSize="11">NO</text>
      <text x="352" y="194" textAnchor="middle" fontSize="11">NO</text>
      <text x="262" y="270" fontSize="11">YES</text>
    </svg>
  ),
};

export default function Flowchart({ name }) {
  return CHARTS[name] || <p className="meta">Flowchart “{name}” not found.</p>;
}
