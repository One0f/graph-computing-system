import { useState, useCallback, type ChangeEvent, useEffect, useRef, type MouseEvent } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnSelectionChangeParams,
  type NodeMouseHandler,
  useReactFlow, 
  ReactFlowProvider,
  MarkerType, 
  Panel,
} from 'reactflow';

// UI 组件
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider'; 
import Tooltip from '@mui/material/Tooltip'; // 核心组件：鼠标悬停提示
import IconButton from '@mui/material/IconButton'; 

// 导入图标
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import TimelineIcon from '@mui/icons-material/Timeline';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import DownloadIcon from '@mui/icons-material/Download';
import TableChartIcon from '@mui/icons-material/TableChart';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import HubIcon from '@mui/icons-material/Hub';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import StarIcon from '@mui/icons-material/Star';
import RouteIcon from '@mui/icons-material/Route';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import RestoreIcon from '@mui/icons-material/Restore';

// 图计算引擎
import Graph from 'graphology';
// @ts-ignore
import forceAtlas2 from 'graphology-layout-forceatlas2';
// @ts-ignore
import louvain from 'graphology-communities-louvain';
// @ts-ignore
import { pagerank } from 'graphology-metrics/centrality';
// @ts-ignore
import { betweenness } from 'graphology-metrics/centrality'; 
// @ts-ignore
import { bidirectional } from 'graphology-shortest-path/unweighted'; 

// 样式
import 'reactflow/dist/style.css';
import './App.css';

// 预设配色
const COMMUNITY_COLORS = ['#FFC107', '#1E88E5', '#F44336', '#4CAF50', '#9C27B0', '#FF9800', '#795548', '#009688', '#E91E63'];

// 初始 Hello World 数据
const initialNodes: Node[] = [
  { id: '1', position: { x: 0, y: 0 }, data: { label: 'Graph' }, style: {width:60, height:60, borderRadius:'50%', border:'1px solid #777', display:'flex', justifyContent:'center', alignItems:'center'} },
  { id: '2', position: { x: -150, y: -100 }, data: { label: 'Hello' }, style: {width:60, height:60, borderRadius:'50%', border:'1px solid #777', display:'flex', justifyContent:'center', alignItems:'center'} },
  { id: '3', position: { x: -150, y: 100 }, data: { label: 'World' }, style: {width:60, height:60, borderRadius:'50%', border:'1px solid #777', display:'flex', justifyContent:'center', alignItems:'center'} },
  { id: '4', position: { x: 200, y: 0 }, data: { label: 'System' }, style: {width:60, height:60, borderRadius:'50%', border:'1px solid #777', display:'flex', justifyContent:'center', alignItems:'center'} },
  { id: '5', position: { x: 400, y: 0 }, data: { label: 'Vesper' }, style: {width:60, height:60, borderRadius:'50%', border:'1px solid #777', display:'flex', justifyContent:'center', alignItems:'center'} },
  { id: '6', position: { x: 400, y: 150 }, data: { label: 'Gin' }, style: {width:60, height:60, borderRadius:'50%', border:'1px solid #777', display:'flex', justifyContent:'center', alignItems:'center'} },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', label: '包含', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e1-3', source: '1', target: '3', label: '包含', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e2-3', source: '2', target: '3', label: '组合', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e1-4', source: '1', target: '4', label: '运行于', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e4-5', source: '4', target: '5', label: '属于', markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e5-6', source: '5', target: '6', label: '拥有', markerEnd: { type: MarkerType.ArrowClosed } },
];

// CSV 解析
const parseCSV = (text: string) => {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) return { headers: [], rows: [] };
  const cleanStr = (s: string) => s ? s.trim().replace(/^["']|["']$/g, '').replace(/^\uFEFF/, '') : '';
  const headers = lines[0].split(',').map(cleanStr);
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(cleanStr);
    return { values };
  });
  return { headers, rows };
};

const findColIndex = (headers: string[], candidates: string[], defaultIdx: number) => {
  const lowerHeaders = headers.map(h => h.toLowerCase());
  const idx = lowerHeaders.findIndex(h => candidates.some(c => h.includes(c)));
  return idx !== -1 ? idx : defaultIdx;
};

function GraphApp() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedElement, setSelectedElement] = useState<Node | Edge | null>(null);

  const [interactionMode, setInteractionMode] = useState<0 | 1 | 2>(0);
  const [tempSourceId, setTempSourceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const graphRef = useRef<Graph | null>(null);
  
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const csvNodesInputRef = useRef<HTMLInputElement>(null);
  const csvEdgesInputRef = useRef<HTMLInputElement>(null);
  
  const { getNodes, getEdges, setCenter, fitView } = useReactFlow(); 

  // 数据同步
  const syncGraph = () => {
    const graph = new Graph();
    getNodes().forEach(n => { try { graph.addNode(n.id, { x: n.position.x, y: n.position.y, ...n.data }); } catch {} });
    getEdges().forEach(e => { try { if(graph.hasNode(e.source)&&graph.hasNode(e.target)) graph.addEdge(e.source, e.target, { label: e.label }); } catch {} });
    graphRef.current = graph;
    return graph;
  };

  useEffect(() => { syncGraph(); }, []);

  const onNodesChange: OnNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange: OnEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    if (params.nodes.length === 1 && params.edges.length === 0) setSelectedElement(params.nodes[0]);
    else if (params.edges.length === 1 && params.nodes.length === 0) setSelectedElement(params.edges[0]);
    else setSelectedElement(null);
  }, []);

  const handleCSVNodesUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const { headers, rows } = parseCSV(evt.target?.result as string);
      const idIdx = findColIndex(headers, ['id', '编号', 'key', 'code', '部门'], 0);
      const lblIdx = findColIndex(headers, ['label', 'name', 'title', '名称', '姓名', '单位', '人员'], 1);

      const newNodes: Node[] = [];
      const seenIdsInFile = new Set(); 

      rows.forEach((r) => {
        const rawId = r.values[idIdx];
        if (!rawId) return;
        const idStr = String(rawId);
        if(!seenIdsInFile.has(idStr)){
            const rawLabel = r.values[lblIdx] || idStr;
            newNodes.push({
                id: idStr,
                position: {x: (Math.random()-0.5)*800, y: (Math.random()-0.5)*600},
                data: {label: String(rawLabel)},
                style: {width:60, height:60, borderRadius:'50%', border:'1px solid #777', display:'flex', justifyContent:'center', alignItems:'center', background:'#fff'}
            });
            seenIdsInFile.add(idStr);
        }
      });

      if (newNodes.length > 0) {
          const shouldClear = window.confirm(`解析到 ${newNodes.length} 个新节点。\n\n【确定】清空当前画布，仅导入新数据\n【取消】保留旧数据，追加新数据`);
          if (shouldClear) {
              setNodes(newNodes);
              setEdges([]); 
              alert(`✅ 画布已重置，导入完成。`);
          } else {
              setNodes(prev => { 
                  const ex = new Set(prev.map(n=>n.id)); 
                  return [...prev, ...newNodes.filter(n=>!ex.has(n.id))]; 
              });
              alert(`✅ 节点追加完成。`);
          }
          setTimeout(() => fitView({duration: 800}), 200);
      } else { alert("⚠️ 未发现有效数据。"); }
    };
    reader.readAsText(file);
    e.target.value=''; 
  };

  const handleCSVEdgesUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const { headers, rows } = parseCSV(evt.target?.result as string);
      
      const srcIdx = findColIndex(headers, ['source', 'from', 'src', 'start', '编号1', '项目', '上级', '部门'], 0);
      const tgtIdx = findColIndex(headers, ['target', 'to', 'tgt', 'end', '编号2', '单位', '人员', '负责人'], 1);
      const lblIdx = findColIndex(headers, ['label', 'rel', 'type', 'relation', '关系', '类型', '职务'], 2);

      const potentialEdges: Edge[] = [];
      const relatedNodeIds = new Set<string>();

      rows.forEach((r, i) => {
         const s = r.values[srcIdx];
         const t = r.values[tgtIdx];
         if(!s || !t) return; 

         const sStr = String(s); 
         const tStr = String(t);
         relatedNodeIds.add(sStr);
         relatedNodeIds.add(tStr);

         potentialEdges.push({ 
             id: `csv-e-${Date.now()}-${i}`, 
             source: sStr, target: tStr, 
             label: lblIdx >= 0 ? String(r.values[lblIdx] || '') : '关系', 
             markerEnd: {type: MarkerType.ArrowClosed, color:'#b1b1b7'}, style:{stroke:'#b1b1b7'}
         });
      });

      if (potentialEdges.length > 0) {
          const shouldClear = window.confirm(`解析到 ${potentialEdges.length} 条关系。\n\n【确定】清空画布，重新生成图谱\n【取消】保留数据，追加新关系 (合并模式)`);
          
          let existingNodeIds: Set<string>;
          if (shouldClear) {
              existingNodeIds = new Set();
          } else {
              existingNodeIds = new Set(getNodes().map(n => n.id));
          }

          const nodesToCreate: Node[] = [];
          relatedNodeIds.forEach(id => {
              if (!existingNodeIds.has(id)) {
                  nodesToCreate.push({
                      id: id,
                      position: {x: (Math.random()-0.5)*1000, y: (Math.random()-0.5)*800},
                      data: { label: id }, 
                      style: {width:50, height:50, borderRadius:'50%', border:'2px dashed #ff9800', background:'#fffde7', display:'flex', justifyContent:'center', alignItems:'center', fontSize:'10px'}
                  });
                  existingNodeIds.add(id); 
              }
          });

          if (shouldClear) {
              setNodes(nodesToCreate);
              setEdges(potentialEdges);
              alert(`✅ 画布重置完成。共创建 ${nodesToCreate.length} 个节点，${potentialEdges.length} 条连线。`);
          } else {
              setNodes(prev => [...prev, ...nodesToCreate]);
              setEdges(prev => [...prev, ...potentialEdges]);
              if (nodesToCreate.length > 0) alert(`✅ 追加成功，自动补全了 ${nodesToCreate.length} 个缺失节点。`);
              else alert(`✅ 关系追加成功。`);
          }
          setTimeout(() => fitView({ duration: 1000, padding: 0.1 }), 200);
      } else { alert("未识别到有效关系数据"); }
    };
    reader.readAsText(file);
    e.target.value='';
  };

  const handleResetStyles = () => {
    setNodes(nds => nds.map(n => ({ 
      ...n, selected: false, style: { 
          ...n.style, border: '1px solid #777', opacity: 1, backgroundColor: '#fff', color: '#000', 
          width: n.style?.width===50?50:60, height: n.style?.height===50?50:60, boxShadow: 'none'
      } 
    })));
    setEdges(eds => eds.map(e => ({ ...e, style: { stroke: '#b1b1b7', strokeWidth: 1, opacity: 1 }, animated: false, markerEnd: { type: MarkerType.ArrowClosed, color: '#b1b1b7' } })));
  };

  const handleSearch = () => {
    if (!searchQuery) return;
    const target = nodes.find(n => (n.data.label || '').includes(searchQuery) || n.id === searchQuery);
    
    if (target) {
      setSelectedElement(target);
      handleResetStyles();
      setNodes(nds => nds.map(n => ({
        ...n, selected: n.id === target.id, style: { ...n.style, boxShadow: n.id === target.id ? '0 0 25px 8px #FF5722' : 'none', border: n.id === target.id ? '3px solid #FF5722' : n.style?.border, opacity: n.id === target.id ? 1 : 0.2 }
      })));
      setEdges(eds => eds.map(e => ({ ...e, style: { stroke: '#ddd', opacity: 0.1 }, animated: false })));
      setCenter(target.position.x, target.position.y, { zoom: 1.5, duration: 800 });
    } else {
      alert(`⚠️ 未找到 "${searchQuery}"`);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    handleResetStyles();
    fitView({ duration: 600 });
  };

  // 防重叠布局
  const runAutoLayout = () => {
    syncGraph();
    const graph = graphRef.current;
    if (!graph?.order) return;
    graph.forEachNode(node => { graph.setNodeAttribute(node, 'size', 50); });
    forceAtlas2.assign(graph, { iterations: 150, settings: { gravity: 0.001, scalingRatio: 2000, adjustSizes: true, barnesHutOptimize: false, strongGravityMode: false }});
    setNodes(nds => nds.map(n => ({ ...n, position: { x: graph.getNodeAttribute(n.id, 'x'), y: graph.getNodeAttribute(n.id, 'y') } })));
    setTimeout(() => fitView({ duration: 1000, padding: 0.5 }), 50);
  };

  const onNodeClick: NodeMouseHandler = useCallback((_: MouseEvent, node: Node) => {
    if (interactionMode === 1) { // 连线
      if (!tempSourceId) {
        setTempSourceId(node.id);
        alert(`🔗 起点已选：【${node.data.label}】\n请点击终点。`);
      } else {
        if (tempSourceId === node.id) return alert("❌ 无法连接自身");
        if (edges.some(e => e.source === tempSourceId && e.target === node.id)) {
          alert("连线已存在");
        } else {
          setEdges(eds => [...eds, { id: `e-${Date.now()}`, source: tempSourceId, target: node.id, label: 'Link', markerEnd: { type: MarkerType.ArrowClosed, color:'#b1b1b7' }, style:{stroke:'#b1b1b7'} }]);
          try { graphRef.current?.addEdge(tempSourceId, node.id); } catch {}
        }
        setTempSourceId(null);
      }
    } else if (interactionMode === 2) { // 寻路
      if (!tempSourceId) {
        setTempSourceId(node.id);
        alert(`📍 寻路起点：【${node.data.label}】\n请点击终点。`);
      } else {
        syncGraph();
        if (!graphRef.current) return;
        try {
          const path = bidirectional(graphRef.current, tempSourceId, node.id);
          if (!path) {
            alert("❌ 两点之间无路径连通");
          } else {
            setNodes(nds => nds.map(n => ({...n, style: { ...n.style, opacity: path.includes(n.id) ? 1 : 0.2, border: path.includes(n.id) ? '4px solid #E91E63' : '1px solid #ddd', zIndex: path.includes(n.id) ? 1000 : 0 }})));
            setEdges(eds => eds.map(e => {
               const isPath = path.includes(e.source) && path.includes(e.target);
               return { ...e, style: { stroke: isPath ? '#E91E63' : '#ddd', strokeWidth: isPath?3:1 }, animated: isPath, opacity: isPath?1:0.2, markerEnd: { type: MarkerType.ArrowClosed, color: isPath?'#E91E63':'#ddd' } };
            }));
            alert(`✅ 路径搜索成功！长度：${path.length - 1} 跳`);
          }
        } catch(e) { console.error(e); }
        setTempSourceId(null);
        setInteractionMode(0);
      }
    }
  }, [interactionMode, tempSourceId, edges, getNodes, getEdges]);

  // Algorithms
  const runDegreeCentrality = () => {
    syncGraph(); const graph = graphRef.current; if (!graph?.order) return;
    const scores: Record<string, number> = {}; let maxDegree = 0;
    graph.forEachNode(node => { const d = graph.degree(node); scores[node] = d; if (d > maxDegree) maxDegree = d; });
    if (maxDegree === 0) maxDegree = 1;
    setNodes(nds => nds.map(n => {
       const ratio = (scores[n.id] || 0) / maxDegree; 
       const intensity = Math.floor(ratio * 200); 
       return { ...n, style: { ...n.style, backgroundColor: `rgb(${255 - intensity}, ${100}, ${100})`, color: '#fff', width: 40+(ratio*50), height: 40+(ratio*50) }};
    }));
    alert("✅ 度中心性分析完成：节点越大越红，连接越多");
  };

  const runBetweenness = () => {
    syncGraph(); const graph = graphRef.current; if (!graph?.order) return;
    const scores = betweenness(graph); const max = Math.max(...(Object.values(scores) as number[])) || 0;
    if (max===0) { alert("ℹ️ 暂无核心桥梁"); return; }
    let found = false;
    setNodes(nds => nds.map(n => {
       const score = scores[n.id] || 0; const isBridge = score > max * 0.5;
       if(isBridge) found=true;
       return { ...n, style: { ...n.style, border: isBridge ? '4px double #9C27B0' : '1px solid #ccc', width: 40+(score/max)*50, height: 40+(score/max)*50 }};
    }));
    alert(found ? "✅ 分析完成：紫色双边框为核心中介节点" : "ℹ️ 图结构较分散，未发现明显中介节点");
  };

  const runPageRank = () => {
    syncGraph(); const graph = graphRef.current; if (!graph?.order) return;
    const scores = pagerank(graph); const max = Math.max(...(Object.values(scores) as number[])) || 1; 
    setNodes(nds => nds.map(n => ({ ...n, style: { ...n.style, width: 30+(scores[n.id]||0)/max*70, height: 30+(scores[n.id]||0)/max*70 }})));
    alert("✅ PageRank 完成：节点越大，权威性越高");
  };

  const runLouvain = () => {
    syncGraph(); const graph = graphRef.current; if (!graph?.order) return;
    louvain.assign(graph);
    setNodes(nds => nds.map(n => {
         const comm = graph.getNodeAttribute(n.id, 'community');
         return { ...n, style: { ...n.style, backgroundColor: COMMUNITY_COLORS[comm % COMMUNITY_COLORS.length], color: '#fff' } };
    }));
    alert("✅ 社区发现完成：不同颜色代表不同社区");
  };

  const downloadFile = (content: string, name: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };
  const handleExportJSON = () => downloadFile(JSON.stringify({ nodes: getNodes(), edges: getEdges() }, null, 2), 'graph.json', 'application/json');
  const handleExportCSV = () => {
    const nRow = getNodes().map(n => `${n.id},${n.data.label},${n.position.x},${n.position.y}`).join("\n");
    downloadFile("id,label,x,y\n" + nRow, 'nodes.csv', 'text/csv');
    setTimeout(() => {
        const eRow = getEdges().map(e => `${e.source},${e.target},${e.label||''},${e.id}`).join("\n");
        downloadFile("source,target,label,id\n" + eRow, 'edges.csv', 'text/csv');
    }, 500);
  };
  const handleJSONUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if(!file)return;
    const r = new FileReader();
    r.onload = (evt) => {
        try { const j = JSON.parse(evt.target?.result as string); if(j.nodes) setNodes(j.nodes); if(j.edges) setEdges(j.edges); alert("✅ JSON 导入成功"); } 
        catch { alert("JSON 格式错误"); }
    };
    r.readAsText(file); e.target.value='';
  };
  
  const handleAddNode = () => setNodes(p=>[...p, {id:`${Date.now()}`, position:{x:400,y:300}, data:{label:`Node ${nodes.length+1}`}, style:{width:60, height:60, borderRadius:'50%', border:'1px solid #777', display:'flex', justifyContent:'center', alignItems:'center'}}]);
  const handleDelete = () => {
      if(!selectedElement) return;
      if('position' in selectedElement) { setNodes(n=>n.filter(x=>x.id!==selectedElement.id)); setEdges(e=>e.filter(x=>x.source!==selectedElement.id && x.target!==selectedElement.id)); } 
      else { setEdges(e=>e.filter(x=>x.id!==selectedElement.id)); }
      setSelectedElement(null);
  };
  const handleLabelChange = (e:ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if('position' in selectedElement!) {
          setNodes(ns=>ns.map(n=>n.id===selectedElement!.id?{...n, data:{...n.data, label:v}}:n));
          setSelectedElement(prev=>({...prev!, data:{...prev!.data, label:v}} as Node));
      } else {
          setEdges(es=>es.map(ed=>ed.id===selectedElement!.id?{...ed, label:v}:ed));
          setSelectedElement(prev=>({...prev!, label:v} as Edge));
      }
  };
  
  const resetDataToDefault = () => {
    if (window.confirm("确定要清空当前图谱并恢复示例数据(Hello World)吗？")) {
        setNodes(initialNodes); setEdges(initialEdges); setTimeout(()=>fitView(),100);
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <input type="file" accept=".json" ref={jsonInputRef} style={{display:'none'}} onChange={handleJSONUpload} />
      <input type="file" accept=".csv" ref={csvNodesInputRef} style={{display:'none'}} onChange={handleCSVNodesUpload} />
      <input type="file" accept=".csv" ref={csvEdgesInputRef} style={{display:'none'}} onChange={handleCSVEdgesUpload} />

      <Box sx={{ width: '340px', p: 2, borderRight: '1px solid #ddd', bgcolor: '#fbfbfb', overflowY: 'auto', display:'flex', flexDirection:'column', gap: 2 }}>
        <Typography variant="h5" color="primary" fontWeight="bold">图计算系统 Demo</Typography>
        <Stack direction="row" spacing={1}>
           <TextField size="small" fullWidth label="搜名称/ID..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSearch()} sx={{bgcolor:'#fff'}}/>
           <Tooltip title="点击搜索并高亮节点"><IconButton color="primary" onClick={handleSearch} sx={{border:'1px solid #eee', bgcolor:'#fff'}}> <SearchIcon/> </IconButton></Tooltip>
           <Tooltip title="清除搜索与重置视角"><IconButton color="error" onClick={clearSearch} sx={{border:'1px solid #eee', bgcolor:'#fff'}}> <CloseIcon/> </IconButton></Tooltip>
        </Stack>
        <Divider />
        <Box className="panel-box">
             <Typography variant="caption" fontWeight="bold" color="text.secondary">编辑 (Editor)</Typography>
             <Stack direction="row" gap={1} mt={1}>
                <Tooltip title="新增一个空白节点"><Button variant="contained" size="small" onClick={handleAddNode} fullWidth startIcon={<AddCircleIcon/>}>节点</Button></Tooltip>
                <Tooltip title="开启连线模式：依次点击两个节点"><Button variant={interactionMode===1?"contained":"outlined"} color="warning" size="small" onClick={()=>{setInteractionMode(p=>p===1?0:1);setTempSourceId(null)}} fullWidth startIcon={<TimelineIcon/>}>{interactionMode===1?'取消':'连线'}</Button></Tooltip>
                <Tooltip title="删除当前选中的节点或关系"><Button variant="outlined" color="error" size="small" disabled={!selectedElement} onClick={handleDelete} fullWidth startIcon={<DeleteIcon/>}>删除</Button></Tooltip>
             </Stack>
        </Box>
        <Box className="panel-box">
             <Typography variant="caption" fontWeight="bold" color="text.secondary">数据 IO (CSV/JSON)</Typography>
             <Stack spacing={1} mt={1}>
                <Stack direction="row" gap={1}>
                    <Tooltip title="保存完整图谱状态"><Button variant="contained" sx={{flex:1, bgcolor:'#333'}} size="small" onClick={handleExportJSON} startIcon={<SaveIcon/>}>JSON 导出</Button></Tooltip>
                    <Tooltip title="读取存档"><Button variant="outlined" sx={{flex:1}} size="small" onClick={()=>jsonInputRef.current?.click()} startIcon={<FileUploadIcon/>}>JSON 导入</Button></Tooltip>
                </Stack>
                <Tooltip title="下载 nodes.csv 和 edges.csv"><Button variant="contained" color="success" size="small" fullWidth onClick={handleExportCSV} startIcon={<DownloadIcon/>}>CSV 导出 (All)</Button></Tooltip>
                <Stack direction="row" gap={1}>
                    <Tooltip title="导入CSV表格，首行需含 ID,Label 等表头"><Button variant="outlined" color="success" size="small" sx={{flex:1}} onClick={()=>csvNodesInputRef.current?.click()} startIcon={<TableChartIcon/>}>导节点</Button></Tooltip>
                    <Tooltip title="导入CSV关系表，自动匹配 Source/Target"><Button variant="outlined" color="success" size="small" sx={{flex:1}} onClick={()=>csvEdgesInputRef.current?.click()} startIcon={<TableChartIcon/>}>导关系</Button></Tooltip>
                </Stack>
             </Stack>
        </Box>
        <Divider />
        <Box className="panel-box">
             <Typography variant="caption" fontWeight="bold" color="text.secondary">图算法分析 (Analytics)</Typography>
             <Stack spacing={1} mt={1}>
                <Tooltip title="ForceAtlas2：模拟物理引力/斥力，自动解开重叠的节点" arrow placement="right"><Button variant="outlined" color="primary" fullWidth sx={{justifyContent:'flex-start', pl:2}} onClick={runAutoLayout} startIcon={<AutoFixHighIcon/>}>整理布局 (Layout)</Button></Tooltip>
                <Tooltip title="Degree Centrality：连接越多，节点越大越红" arrow placement="right"><Button variant="outlined" fullWidth sx={{justifyContent:'flex-start', pl:2}} onClick={runDegreeCentrality} startIcon={<HubIcon/>}>度中心性 (Degree)</Button></Tooltip>
                <Tooltip title="Betweenness Centrality：寻找网络中的“桥梁”，重要节点显紫色" arrow placement="right"><Button variant="outlined" color="secondary" fullWidth sx={{justifyContent:'flex-start', pl:2}} onClick={runBetweenness} startIcon={<CompareArrowsIcon/>}>介数中心性 (Bridge)</Button></Tooltip>
                <Tooltip title="Louvain：自动识别社区团伙，并按颜色区分" arrow placement="right"><Button variant="outlined" color="info" fullWidth sx={{justifyContent:'flex-start', pl:2}} onClick={runLouvain} startIcon={<GroupWorkIcon/>}>社区发现 (Louvain)</Button></Tooltip>
                <Tooltip title="PageRank：Google算法，根据引用关系评估权威度" arrow placement="right"><Button variant="outlined" color="success" fullWidth sx={{justifyContent:'flex-start', pl:2}} onClick={runPageRank} startIcon={<StarIcon/>}>PageRank 排名</Button></Tooltip>
                <Divider sx={{my:0.5}}/>
                <Tooltip title="Dijkstra：查找两点间的最短链路" arrow placement="right"><Button variant={interactionMode===2?"contained":"outlined"} color="error" fullWidth sx={{justifyContent:'flex-start', pl: 2}} onClick={()=>{setInteractionMode(p=>p===2?0:2); setTempSourceId(null); if(interactionMode===2)handleResetStyles()}} startIcon={<RouteIcon/>}>{interactionMode===2?'❌ 退出寻路':'🛤️ 最短路径分析'}</Button></Tooltip>
                <Stack direction="row" gap={1}>
                    <Tooltip title="清除所有算法颜色，恢复默认样式"><Button size="small" fullWidth sx={{color:'#999'}} onClick={handleResetStyles} startIcon={<RestartAltIcon/>}>重置样式</Button></Tooltip>
                    <Tooltip title="清空画布，加载演示数据"><Button size="small" fullWidth sx={{color:'#1976d2'}} onClick={resetDataToDefault} startIcon={<RestoreIcon/>}>恢复数据</Button></Tooltip>
                </Stack>
             </Stack>
        </Box>
        {selectedElement && (<Box sx={{p:2, bgcolor:'#e3f2fd', borderRadius:2, border:'1px solid #90CAF9'}}><Typography variant="caption" fontWeight="bold">属性面板</Typography><TextField size="small" fullWidth sx={{bgcolor:'#fff', mt:1}} label="名称/Label" value={'position' in selectedElement ? selectedElement.data.label : selectedElement.label || ''} onChange={handleLabelChange} /><Typography variant="caption" display="block" sx={{mt:1, color:'#666'}}>ID: {selectedElement.id}</Typography></Box>)}
      </Box>
      <Box sx={{ flex: 1 }}>
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onSelectionChange={onSelectionChange} onNodeClick={onNodeClick} fitView><Background color="#ccc" gap={24} /><Controls /><MiniMap style={{height: 120}} zoomable pannable /><Panel position="top-right" style={{color:'#aaa', fontSize:'12px'}}>Graph Computing System v2.2</Panel></ReactFlow>
      </Box>
    </Box>
  );
}
export default () => (<ReactFlowProvider><GraphApp /></ReactFlowProvider>);