import { useState, useRef, useEffect } from 'react';

const ELEMENT_TYPES = ['INPUT', 'AND', 'OR', 'NOT', 'OUTPUT'];
let nodeIdCounter = 1;

const LogicNode = ({ node, onMouseDown }) => (
  <g
    transform={`translate(${node.x}, ${node.y})`}
    onMouseDown={(e) => onMouseDown(e, node)}
    style={{ cursor: 'move' }}
  >
    <rect width="60" height="40" fill={node.state ? '#90EE90' : '#F0F0F0'} stroke="black" rx="5" />
    <text x="5" y="20" fontSize="12">{node.type} {node.label || ''}</text>
  </g>
);

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedType, setSelectedType] = useState('INPUT');
  const [dragNode, setDragNode] = useState(null);
  const [connectMode, setConnectMode] = useState(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const svgRef = useRef(null);

  // History for undo/redo
  const [history, setHistory] = useState([]);
  const [histIndex, setHistIndex] = useState(-1);

  // Push current state to history
  const pushHistory = (newNodes, newConnections) => {
    const snapshot = { nodes: newNodes, connections: newConnections };
    const updated = history.slice(0, histIndex + 1);
    setHistory([...updated, snapshot]);
    setHistIndex(updated.length);
  };

  // Initialize history on first mount
  useEffect(() => {
    pushHistory(nodes, connections);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addNode = (x, y) => {
    const label = prompt('Имя сигнала (опционально):', '');
    const newNode = {
      id: nodeIdCounter++, type: selectedType,
      x, y, state: false, label, inputs: []
    };
    const newNodes = [...nodes, newNode];
    setNodes(newNodes);
    pushHistory(newNodes, connections);
  };

  const deleteNode = (targetId) => {
    const newNodes = nodes.filter(n => n.id !== targetId)
      .map(n => ({ ...n, inputs: n.inputs.filter(id => id !== targetId) }));
    const newConnections = connections.filter(c => c.from !== targetId && c.to !== targetId);
    setNodes(newNodes);
    setConnections(newConnections);
    pushHistory(newNodes, newConnections);
  };

  const onSvgClick = (e) => {
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
        const newNodes = nodes.map(n => n.id === target.id
          ? { ...n, inputs: [...n.inputs, connectMode.id] }
          : n
        );
        setNodes(newNodes);
        pushHistory(newNodes, newConnections);
      }
      setConnectMode(null);
    }
  };

  const getNodeAt = (x, y) => nodes.find(n => x >= n.x && x <= n.x + 60 && y >= n.y && y <= n.y + 40);

  const onMouseDown = (e, node) => {
    if (e.shiftKey) {
      setConnectMode(node);
    } else {
      setDragNode({ node, offsetX: e.clientX - node.x, offsetY: e.clientY - node.y });
    }
    e.stopPropagation();
  };

  const onMouseMove = (e) => {
    if (dragNode) {
      const { node, offsetX, offsetY } = dragNode;
      const newX = e.clientX - offsetX;
      const newY = e.clientY - offsetY;
      const newNodes = nodes.map(n => n.id === node.id ? { ...n, x: newX, y: newY } : n);
      setNodes(newNodes);
    }
  };

  const onMouseUp = () => setDragNode(null);

  const simulate = () => {
    const updated = [...nodes];
    for (let i = 0; i < 5; i++) {
      for (let node of updated) {
        if (node.type === 'INPUT') continue;
        const inputStates = node.inputs.map(id => updated.find(n => n.id === id)?.state || false);
        switch(node.type) {
          case 'AND': node.state = inputStates.every(Boolean); break;
          case 'OR': node.state = inputStates.some(Boolean); break;
          case 'NOT': node.state = inputStates.length ? !inputStates[0] : false; break;
          case 'OUTPUT': node.state = inputStates[0] || false; break;
        }
      }
    }
    setNodes(updated);
    pushHistory(updated, connections);
  };

  const toggleInputState = (id) => {
    const newNodes = nodes.map(n => n.id === id && n.type === 'INPUT' ? { ...n, state: !n.state } : n);
    setNodes(newNodes);
    pushHistory(newNodes, connections);
  };

  const undo = () => {
    if (histIndex > 0) {
      const prev = history[histIndex - 1];
      setNodes(prev.nodes);
      setConnections(prev.connections);
      setHistIndex(histIndex - 1);
    }
  };

  const redo = () => {
    if (histIndex < history.length - 1) {
      const next = history[histIndex + 1];
      setNodes(next.nodes);
      setConnections(next.connections);
      setHistIndex(histIndex + 1);
    }
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

  const loadScheme = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { nodes: loadedNodes, connections: loadedCon } = JSON.parse(reader.result);
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
    <div>
      <div style={{ marginBottom: '10px' }}>
        <select value={selectedType} onChange={e => setSelectedType(e.target.value)}>
          {ELEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={simulate}>Симулировать</button>
        <button onClick={() => setDeleteMode(d => !d)} style={{ marginLeft: 8 }}>
          {deleteMode ? 'Отмена удаления' : 'Удалить узел'}
        </button>
        <button onClick={undo} disabled={histIndex <= 0} style={{ marginLeft: 8 }}>Undo</button>
        <button onClick={redo} disabled={histIndex >= history.length - 1} style={{ marginLeft: 8 }}>Redo</button>
        <button onClick={saveScheme} style={{ marginLeft: 8 }}>Сохранить</button>
        <input type="file" accept="application/json" onChange={loadScheme} style={{ marginLeft: 8 }} />
        <span style={{ marginLeft: '10px', fontStyle: 'italic' }}>
          Клик — добавить. Shift+клик — соединить. Клик по INPUT — смена состояния.
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
        style={{ border: '1px solid #ccc' }}
      >
        {connections.map((conn, i) => {
          const from = nodes.find(n => n.id === conn.from);
          const to = nodes.find(n => n.id === conn.to);
          if (!from || !to) return null;
          return (
            <line
              key={i}
              x1={from.x + 60}
              y1={from.y + 20}
              x2={to.x}
              y2={to.y + 20}
              stroke="black"
            />
          );
        })}
        {nodes.map(node => (
          <LogicNode
            key={node.id}
            node={node}
            onMouseDown={(e) => {
              if (node.type === 'INPUT') {
                e.preventDefault();
                toggleInputState(node.id);
              }
              onMouseDown(e, node);
            }}
          />
        ))}
      </svg>
    </div>
  );
}
