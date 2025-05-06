import { useState, useRef, useEffect } from 'react';

const ELEMENT_TYPES = ['INPUT', 'AND', 'OR', 'NOT', 'OUTPUT'];
let nodeIdCounter = 1;

// Check if two rectangles overlap
const isOverlap = (a, b) => {
  return a.x < b.x + 60 && a.x + 60 > b.x && a.y < b.y + 40 && a.y + 40 > b.y;
};

const LogicNode = ({ node, onMouseDown, onMouseEnter, onMouseLeave, onDoubleClick }) => (
  <g
    transform={`translate(${node.x}, ${node.y})`}
    onMouseDown={e => onMouseDown(e, node)}
    onMouseEnter={() => onMouseEnter(node)}
    onMouseLeave={() => onMouseLeave()}
    onDoubleClick={e => onDoubleClick(e, node)}
    style={{ cursor: 'move' }}
  >
    <rect
      width="60"
      height="40"
      fill={node.state ? '#90EE90' : '#F0F0F0'}
      stroke={node.highlight ? '#FF8C00' : 'black'}
      strokeWidth={node.highlight ? 2 : 1}
      rx="5"
      style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
    />
    <text x="5" y="22" fontSize="12" fontFamily="sans-serif">
      {node.type} {node.label || ''}
    </text>
  </g>
);

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedType, setSelectedType] = useState('INPUT');
  const [dragNode, setDragNode] = useState(null);
  const [connectMode, setConnectMode] = useState(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const svgRef = useRef(null);

  // History for undo/redo
  const [history, setHistory] = useState([]);
  const [histIndex, setHistIndex] = useState(-1);

  const pushHistory = (newNodes, newConnections) => {
    const snapshot = { nodes: newNodes, connections: newConnections };
    const updated = history.slice(0, histIndex + 1);
    setHistory([...updated, snapshot]);
    setHistIndex(updated.length);
  };

  useEffect(() => {
    pushHistory(nodes, connections);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add node without prompt, empty label
  const addNode = (x, y) => {
    if (nodes.some(n => isOverlap({ x, y }, n))) return;
    const newNode = { id: nodeIdCounter++, type: selectedType, x, y, state: false, label: '', inputs: [] };
    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    pushHistory(newNodes, connections);
  };

  const deleteNode = targetId => {
    const newNodes = nodes
      .filter(n => n.id !== targetId)
      .map(n => ({ ...n, inputs: n.inputs.filter(id => id !== targetId) }));
    const newConnections = connections.filter(c => c.from !== targetId && c.to !== targetId);
    setNodes(newNodes);
    setConnections(newConnections);
    pushHistory(newNodes, newConnections);
  };

  const onSvgClick = e => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const target = getNodeAt(x, y);

    if (deleteMode && target) {
      deleteNode(target.id);
      setDeleteMode(false);
      return;
    }
    if (!connectMode) {
      addNode(x, y);
    } else {
      if (target && target.id !== connectMode.id) {
        const newCon = { from: connectMode.id, to: target.id };
        const newConnections = [...connections, newCon];
        setConnections(newConnections);
        const newNodes = nodes.map(n =>
          n.id === target.id ? { ...n, inputs: [...n.inputs, connectMode.id] } : n
        );
        setNodes(newNodes);
        pushHistory(newNodes, newConnections);
      }
      setConnectMode(null);
    }
  };

  const getNodeAt = (x, y) =>
    nodes.find(n => x >= n.x && x <= n.x + 60 && y >= n.y && y <= n.y + 40);

  const onMouseDown = (e, node) => {
    if (e.shiftKey) {
      setConnectMode(node);
    } else {
      setDragNode({ node, offsetX: e.clientX - node.x, offsetY: e.clientY - node.y });
    }
    e.stopPropagation();
  };

  const onMouseMove = e => {
    if (!dragNode) return;
    const { node, offsetX, offsetY } = dragNode;
    const newX = e.clientX - offsetX;
    const newY = e.clientY - offsetY;
    const temp = { ...node, x: newX, y: newY };
    if (nodes.some(n => n.id !== node.id && isOverlap(temp, n))) return;
    const newNodes = nodes.map(n => (n.id === node.id ? temp : n));
    setNodes(newNodes);
  };

  const onMouseUp = () => setDragNode(null);

  const simulate = () => {
    const updated = [...nodes];
    for (let i = 0; i < 5; i++) {
      updated.forEach(node => {
        if (node.type === 'INPUT') return;
        const inputStates = node.inputs.map(
          id => updated.find(n => n.id === id)?.state || false
        );
        switch (node.type) {
          case 'AND':
            node.state = inputStates.every(Boolean);
            break;
          case 'OR':
            node.state = inputStates.some(Boolean);
            break;
          case 'NOT':
            node.state = inputStates.length ? !inputStates[0] : false;
            break;
          case 'OUTPUT':
            node.state = inputStates[0] || false;
            break;
          default:
            break;
        }
      });
    }
    setNodes(updated);
    pushHistory(updated, connections);
  };

  const toggleInputState = id => {
    const newNodes = nodes.map(n =>
      n.id === id && n.type === 'INPUT' ? { ...n, state: !n.state } : n
    );
    setNodes(newNodes);
    pushHistory(newNodes, connections);
  };

  // Handle double-click to set label only for INPUT/OUTPUT
  const onNodeDoubleClick = (e, node) => {
    e.stopPropagation();
    if (node.type === 'INPUT' || node.type === 'OUTPUT') {
      const newLabel = prompt('Имя сигнала:', node.label || '');
      if (newLabel !== null) {
        const newNodes = nodes.map(n =>
          n.id === node.id ? { ...n, label: newLabel } : n
        );
        setNodes(newNodes);
        pushHistory(newNodes, connections);
      }
    }
  };

  const undo = () => {
    if (histIndex <= 0) return;
    const prev = history[histIndex - 1];
    setNodes(prev.nodes);
    setConnections(prev.connections);
    setHistIndex(histIndex - 1);
  };

  const redo = () => {
    if (histIndex >= history.length - 1) return;
    const next = history[histIndex + 1];
    setNodes(next.nodes);
    setConnections(next.connections);
    setHistIndex(histIndex + 1);
  };

  const saveScheme = () => {
    const dataStr = JSON.stringify({ nodes, connections });
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scheme.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadScheme = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { nodes: loadedNodes, connections: loadedCon } =
          JSON.parse(reader.result);
        setNodes(loadedNodes);
        setConnections(loadedCon);
        pushHistory(loadedNodes, loadedCon);
      } catch {
        alert('Ошибка загрузки схемы');
      }
    };
   	reader.readAsText(file);
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          background: '#f5f5f5',
          padding: '8px 12px',
          borderRadius: 8
        }}
      >
        <select
          value={selectedType}
          onChange={e => setSelectedType(e.target.value)}
        >
          {ELEMENT_TYPES.map(t => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          onClick={simulate}
          style={{ padding: '6px 12px', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          Симулировать
        </button>
        <button
          onClick={() => setDeleteMode(d => !d)}
          style={{ padding: '6px 12px', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          {deleteMode ? 'Отмена удаления' : 'Удалить'}
        </button>
        <button
          onClick={undo}
          disabled={histIndex <= 0}
          style={{ padding: '6px 12px', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          Undo
        </button>
        <button
          onClick={redo}
          disabled={histIndex >= history.length - 1}
          style={{ padding: '6px 12px', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          Redo
        </button>
        <button
          onClick={saveScheme}
          style={{ padding: '6px 12px', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          Сохранить
        </button>
        <label
          style={{ padding: '6px 12px', background: '#ddd', borderRadius: 4, cursor: 'pointer' }}
        >
          Загрузить
          <input
            type="file"
            accept="application/json"
            onChange={loadScheme}
            style={{ display: 'none' }}
          />
        </label>
        <span style={{ marginLeft: 'auto', fontStyle: 'italic', color: '#555' }}>
          Click — добавить, Shift+Click — соединить, Click по INPUT — смена состояния, DoubleClick по INPUT/OUTPUT — задать имя
        </span>
      </div>

      <svg
        ref={svgRef}
        width="800"
        height="600"
        onClick={onSvgClick}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        tabIndex={0}
        style={{ border: '1px solid #ccc', borderRadius: 8 }}
      >
        {connections.map((conn, i) => {
          const from = nodes.find(n => n.id === conn.from);
          const to = nodes.find(n => n.id === conn.to);
          if (!from || !to) return null;
          const isActive = connectMode && from.id === connectMode.id;
          const isHover = hoveredNode && (conn.from === hoveredNode.id || conn.to === hoveredNode.id);
          return (
            <line
              key={i}
              x1={from.x + 60}
              y1={from.y + 20}
              x2={to.x}
              y2={to.y + 20}
              stroke={isActive ? '#FF4500' : isHover ? '#1E90FF' : 'black'}
              strokeWidth={isActive || isHover ? 2 : 1}
              style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
            />
          );
        })}
        {nodes.map(node => (
          <LogicNode
            key={node.id}
            node={{ ...node, highlight: hoveredNode && hoveredNode.id === node.id }}
            onMouseDown={(e) => {
              if (node.type === 'INPUT') {
                e.preventDefault();
                toggleInputState(node.id);
              }
              onMouseDown(e, node);
            }}
            onMouseEnter={() => setHoveredNode(node)}
            onMouseLeave={() => setHoveredNode(null)}
            onDoubleClick={(e) => onNodeDoubleClick(e, node)}
          />
        ))}
      </svg>
    </div>
  );
}
