import { useMemo } from 'react';

const NODE_W = 112;
const NODE_H = 38;
const GAP_X = 28;
const GAP_Y = 64;

// Place les personnes par génération, triées pour que les traits se croisent le moins possible.
export function layoutFamily(members, links) {
  const nodes = [{ id: 'me', name: 'Vous', generation: 0, self: true }, ...members];
  const parentsOf = new Map();
  const partnerOf = new Map();
  for (const link of links) {
    if (link.kind === 'parent') {
      parentsOf.set(link.to, [...(parentsOf.get(link.to) ?? []), link.from]);
    } else {
      partnerOf.set(link.from, link.to);
      partnerOf.set(link.to, link.from);
    }
  }

  const byGeneration = new Map();
  for (const node of nodes) {
    byGeneration.set(node.generation, [...(byGeneration.get(node.generation) ?? []), node]);
  }

  const position = new Map();
  const generations = [...byGeneration.keys()].sort((a, b) => a - b);
  for (const generation of generations) {
    const row = byGeneration.get(generation);
    const score = (node) => {
      const parents = (parentsOf.get(node.id) ?? []).filter((id) => position.has(id));
      return parents.length ? parents.reduce((sum, id) => sum + position.get(id), 0) / parents.length : Infinity;
    };
    const sorted = [...row].sort((a, b) => score(a) - score(b));
    const ordered = [];
    for (const node of sorted) {
      if (ordered.includes(node)) continue;
      ordered.push(node);
      const partner = row.find((other) => other.id === partnerOf.get(node.id));
      if (partner && !ordered.includes(partner)) ordered.push(partner);
    }
    ordered.forEach((node, index) => position.set(node.id, index));
    byGeneration.set(generation, ordered);
  }

  const widest = Math.max(...generations.map((generation) => byGeneration.get(generation).length));
  const width = widest * (NODE_W + GAP_X) + GAP_X;
  const placed = new Map();
  generations.forEach((generation, rowIndex) => {
    const row = byGeneration.get(generation);
    const rowWidth = row.length * (NODE_W + GAP_X) - GAP_X;
    row.forEach((node, index) => {
      placed.set(node.id, { node, x: (width - rowWidth) / 2 + index * (NODE_W + GAP_X), y: GAP_Y / 2 + rowIndex * (NODE_H + GAP_Y) });
    });
  });
  return { placed, width, height: generations.length * (NODE_H + GAP_Y) };
}

export default function FamilyGraph({ members, links, onRemove, onSelect, selected, t }) {
  const layout = useMemo(() => layoutFamily(members, links), [members, links]);
  const { placed, width, height } = layout;

  const lines = links.map((link, index) => {
    const from = placed.get(link.from);
    const to = placed.get(link.to);
    if (!from || !to) return null;
    if (link.kind === 'partner') {
      const y = from.y + NODE_H / 2;
      const left = from.x < to.x ? from : to;
      const right = left === from ? to : from;
      return <line key={index} className="tree-line tree-partner" x1={left.x + NODE_W} y1={y} x2={right.x} y2={y} />;
    }
    const x1 = from.x + NODE_W / 2;
    const y1 = from.y + NODE_H;
    const x2 = to.x + NODE_W / 2;
    const y2 = to.y;
    const mid = (y1 + y2) / 2;
    return <path key={index} className="tree-line" d={`M${x1},${y1} V${mid} H${x2} V${y2}`} fill="none" />;
  });

  return (
    <div className="tree-graph-scroll">
      <svg className="tree-graph" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('Arbre généalogique')}>
        {lines}
        {[...placed.values()].map(({ node, x, y }) => (
          <g key={node.id} className={`tree-svg-node${node.self ? ' tree-svg-self' : ''}${selected === node.id ? ' tree-svg-selected' : ''}`} transform={`translate(${x},${y})`} onClick={() => onSelect(node.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') onSelect(node.id); }}>
            <title>{node.note || node.name}</title>
            <rect width={NODE_W} height={NODE_H} rx="10" />
            <text x={NODE_W / 2} y={NODE_H / 2 + 5} textAnchor="middle">{node.self ? '⭐ ' + t('Vous') : node.name.length > 13 ? node.name.slice(0, 12) + '…' : node.name}</text>
            {!node.self ? (
              <g className="tree-svg-remove" transform={`translate(${NODE_W - 8},-6)`} onClick={(event) => { event.stopPropagation(); onRemove(node.id); }} role="button" aria-label={t('Retirer')}>
                <circle r="9" /><text textAnchor="middle" y="4">×</text>
              </g>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}
