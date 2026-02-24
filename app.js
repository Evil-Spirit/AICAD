const canvas = document.getElementById('cadCanvas');
const ctx = canvas.getContext('2d');

const statusbar = document.getElementById('statusbar');
const toolButtons = [...document.querySelectorAll('.tool')];
const showGridEl = document.getElementById('showGrid');
const snapGridEl = document.getElementById('snapGrid');
const dragonIterationsEl = document.getElementById('dragonIterations');
const stickmanPoseEl = document.getElementById('stickmanPose');
const selectionInfo = document.getElementById('selectionInfo');
const entityList = document.getElementById('entityList');
const dimensionList = document.getElementById('dimensionList');
const constraintList = document.getElementById('constraintList');

const newDocBtn = document.getElementById('newDocBtn');
const saveBtn = document.getElementById('saveBtn');
const loadInput = document.getElementById('loadInput');

const constraintTypeEl = document.getElementById('constraintType');
const applyConstraintBtn = document.getElementById('applyConstraintBtn');

let currentTool = 'select';
let tempPoints = [];
let mouse = { x: 0, y: 0 };
let moveDrag = {
  active: false,
  entityId: null,
  last: null,
};

const state = {
  entities: [],
  dimensions: [],
  constraints: [],
  selected: [],
  gridSize: 20,
  idCounter: 1,
};

function nextId(prefix) {
  return `${prefix}_${state.idCounter++}`;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angle(center, pt) {
  return Math.atan2(pt.y - center.y, pt.x - center.x);
}

function normalizeAngle(a) {
  let result = a;
  while (result < 0) result += Math.PI * 2;
  while (result > Math.PI * 2) result -= Math.PI * 2;
  return result;
}

function cubicBezierPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  const a = mt2 * mt;
  const b = 3 * mt2 * t;
  const c = 3 * mt * t2;
  const d = t2 * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

function dragonCurvePoints(p0, p1, iterations) {
  const points = [p0];

  function recurse(a, b, depth, sign) {
    if (depth === 0) {
      points.push({ x: b.x, y: b.y });
      return;
    }
    const mx = (a.x + b.x) / 2 + sign * (b.y - a.y) / 2;
    const my = (a.y + b.y) / 2 - sign * (b.x - a.x) / 2;
    const m = { x: mx, y: my };
    recurse(a, m, depth - 1, 1);
    recurse(m, b, depth - 1, -1);
  }

  recurse(p0, p1, Math.max(0, Math.floor(iterations)), 1);
  return points;
}

function polylineDistanceToPoint(points, pt) {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const A = points[i];
    const B = points[i + 1];
    const vx = B.x - A.x;
    const vy = B.y - A.y;
    const len2 = vx * vx + vy * vy;
    if (len2 === 0) continue;
    const t = Math.max(0, Math.min(1, ((pt.x - A.x) * vx + (pt.y - A.y) * vy) / len2));
    const proj = { x: A.x + t * vx, y: A.y + t * vy };
    best = Math.min(best, distance(proj, pt));
  }
  return best;
}

function segmentDistanceToPoint(a, b, pt) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return distance(a, pt);
  const t = Math.max(0, Math.min(1, ((pt.x - a.x) * vx + (pt.y - a.y) * vy) / len2));
  return distance({ x: a.x + t * vx, y: a.y + t * vy }, pt);
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function randomPick(arr, randomFn = Math.random) {
  return arr[Math.floor(randomFn() * arr.length)];
}

function colorFromId(id) {
  const hue = hashString(String(id)) % 360;
  return `hsl(${hue}, 78%, 62%)`;
}

function randomEntityColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 78%, 62%)`;
}

function getEntityColor(entity) {
  return entity.color || colorFromId(entity.id);
}

function generateFunnyFace(randomFn = Math.random) {
  const gender = randomFn() < 0.5 ? 'male' : 'female';
  const mood = randomPick(['happy', 'kind', 'angry', 'sleepy', 'surprised'], randomFn);
  const eyes = randomPick(['dot', 'smile', 'angry', 'wide'], randomFn);
  const mouth = randomPick(['smile', 'wideSmile', 'neutral', 'oh', 'smirk'], randomFn);
  const hair = gender === 'female'
    ? randomPick(['long', 'buns', 'ponytail', 'short', 'spiky'], randomFn)
    : randomPick(['short', 'spiky', 'mohawk', 'bald', 'messy'], randomFn);
  const hasMoustache = gender === 'male' ? randomFn() < 0.45 : randomFn() < 0.08;
  const hasBeard = gender === 'male' ? randomFn() < 0.38 : randomFn() < 0.03;
  const hasFreckles = randomFn() < 0.25;
  const hasBrows = randomFn() < 0.75;
  return {
    gender,
    mood,
    eyes,
    mouth,
    hair,
    hasMoustache,
    hasBeard,
    hasFreckles,
    hasBrows,
  };
}

function getStickmanFace(stickman) {
  if (stickman.face) return stickman.face;
  const rnd = seededRandom(hashString(String(stickman.id || 'stickman')));
  return generateFunnyFace(rnd);
}

function buildStickmanGeometry(headCenter, scalePoint, pose = 'run') {
  const size = Math.max(14, distance(headCenter, scalePoint));
  const headRadius = size * 0.32;
  const neck = { x: headCenter.x, y: headCenter.y + headRadius };
  let pelvis = { x: headCenter.x, y: neck.y + size * 1.15 };
  let shoulder = { x: neck.x, y: neck.y + (pelvis.y - neck.y) * 0.35 };
  let leftHand = { x: headCenter.x - size * 0.7, y: shoulder.y + size * 0.2 };
  let rightHand = { x: headCenter.x + size * 0.7, y: shoulder.y + size * 0.2 };
  let leftFoot = { x: headCenter.x - size * 0.5, y: pelvis.y + size * 0.95 };
  let rightFoot = { x: headCenter.x + size * 0.5, y: pelvis.y + size * 0.95 };

  if (pose === 'run') {
    pelvis = { x: headCenter.x + size * 0.18, y: neck.y + size * 1.05 };
    shoulder = { x: neck.x + size * 0.08, y: neck.y + size * 0.4 };
    leftHand = { x: shoulder.x - size * 0.95, y: shoulder.y + size * 0.2 };
    rightHand = { x: shoulder.x + size * 0.7, y: shoulder.y - size * 0.45 };
    leftFoot = { x: pelvis.x - size * 0.95, y: pelvis.y + size * 0.55 };
    rightFoot = { x: pelvis.x + size * 0.9, y: pelvis.y + size * 0.35 };
  }

  if (pose === 'jump') {
    pelvis = { x: headCenter.x, y: neck.y + size * 0.95 };
    shoulder = { x: neck.x, y: neck.y + size * 0.28 };
    leftHand = { x: shoulder.x - size * 0.82, y: shoulder.y - size * 0.7 };
    rightHand = { x: shoulder.x + size * 0.82, y: shoulder.y - size * 0.7 };
    leftFoot = { x: pelvis.x - size * 0.65, y: pelvis.y + size * 0.4 };
    rightFoot = { x: pelvis.x + size * 0.65, y: pelvis.y + size * 0.4 };
  }

  if (pose === 'sit') {
    pelvis = { x: headCenter.x + size * 0.08, y: neck.y + size * 0.92 };
    shoulder = { x: neck.x, y: neck.y + size * 0.32 };
    leftHand = { x: shoulder.x - size * 0.55, y: shoulder.y + size * 0.45 };
    rightHand = { x: shoulder.x + size * 0.55, y: shoulder.y + size * 0.45 };
    leftFoot = { x: pelvis.x + size * 0.95, y: pelvis.y + size * 0.18 };
    rightFoot = { x: pelvis.x + size * 0.95, y: pelvis.y + size * 0.55 };
  }

  if (pose === 'lie') {
    pelvis = { x: neck.x + size * 1.1, y: neck.y + size * 0.08 };
    shoulder = { x: neck.x + size * 0.35, y: neck.y + size * 0.05 };
    leftHand = { x: shoulder.x + size * 0.4, y: shoulder.y - size * 0.6 };
    rightHand = { x: shoulder.x + size * 0.45, y: shoulder.y + size * 0.6 };
    leftFoot = { x: pelvis.x + size * 0.7, y: pelvis.y - size * 0.5 };
    rightFoot = { x: pelvis.x + size * 0.75, y: pelvis.y + size * 0.5 };
  }

  if (pose === 'fly') {
    pelvis = { x: neck.x + size * 0.88, y: neck.y - size * 0.78 };
    shoulder = { x: neck.x + size * 0.2, y: neck.y - size * 0.2 };
    leftHand = { x: shoulder.x - size * 0.95, y: shoulder.y - size * 0.65 };
    rightHand = { x: shoulder.x + size * 1.1, y: shoulder.y - size * 0.3 };
    leftFoot = { x: pelvis.x - size * 0.95, y: pelvis.y + size * 0.15 };
    rightFoot = { x: pelvis.x + size * 0.45, y: pelvis.y + size * 0.95 };
  }

  return {
    headCenter,
    headRadius,
    pose,
    neck,
    shoulder,
    pelvis,
    leftHand,
    rightHand,
    leftFoot,
    rightFoot,
  };
}

function drawStickmanFace(geo, face) {
  const r = geo.headRadius;
  const eyeY = geo.headCenter.y - r * 0.15;
  const eyeDX = r * 0.42;
  const leftEye = { x: geo.headCenter.x - eyeDX, y: eyeY };
  const rightEye = { x: geo.headCenter.x + eyeDX, y: eyeY };
  const browY = eyeY - r * 0.22;
  const mouthY = geo.headCenter.y + r * 0.38;

  if (face.hasBrows) {
    ctx.beginPath();
    if (face.mood === 'angry') {
      ctx.moveTo(leftEye.x - r * 0.16, browY + r * 0.08);
      ctx.lineTo(leftEye.x + r * 0.16, browY - r * 0.05);
      ctx.moveTo(rightEye.x - r * 0.16, browY - r * 0.05);
      ctx.lineTo(rightEye.x + r * 0.16, browY + r * 0.08);
    } else {
      ctx.moveTo(leftEye.x - r * 0.17, browY);
      ctx.lineTo(leftEye.x + r * 0.17, browY - r * 0.03);
      ctx.moveTo(rightEye.x - r * 0.17, browY - r * 0.03);
      ctx.lineTo(rightEye.x + r * 0.17, browY);
    }
    ctx.stroke();
  }

  ctx.beginPath();
  if (face.eyes === 'dot') {
    ctx.arc(leftEye.x, leftEye.y, r * 0.08, 0, Math.PI * 2);
    ctx.arc(rightEye.x, rightEye.y, r * 0.08, 0, Math.PI * 2);
  }
  if (face.eyes === 'smile') {
    ctx.arc(leftEye.x, leftEye.y, r * 0.14, 0, Math.PI);
    ctx.arc(rightEye.x, rightEye.y, r * 0.14, 0, Math.PI);
  }
  if (face.eyes === 'angry') {
    ctx.moveTo(leftEye.x - r * 0.14, leftEye.y + r * 0.1);
    ctx.lineTo(leftEye.x + r * 0.14, leftEye.y - r * 0.08);
    ctx.moveTo(rightEye.x - r * 0.14, rightEye.y - r * 0.08);
    ctx.lineTo(rightEye.x + r * 0.14, rightEye.y + r * 0.1);
  }
  if (face.eyes === 'wide') {
    ctx.arc(leftEye.x, leftEye.y, r * 0.11, 0, Math.PI * 2);
    ctx.arc(rightEye.x, rightEye.y, r * 0.11, 0, Math.PI * 2);
  }
  ctx.stroke();

  ctx.beginPath();
  if (face.mouth === 'smile') {
    ctx.arc(geo.headCenter.x, mouthY, r * 0.34, 0.15 * Math.PI, 0.85 * Math.PI);
  }
  if (face.mouth === 'wideSmile') {
    ctx.arc(geo.headCenter.x, mouthY, r * 0.38, 0.08 * Math.PI, 0.92 * Math.PI);
  }
  if (face.mouth === 'neutral') {
    ctx.moveTo(geo.headCenter.x - r * 0.24, mouthY);
    ctx.lineTo(geo.headCenter.x + r * 0.24, mouthY);
  }
  if (face.mouth === 'oh') {
    ctx.arc(geo.headCenter.x, mouthY, r * 0.14, 0, Math.PI * 2);
  }
  if (face.mouth === 'smirk') {
    ctx.moveTo(geo.headCenter.x - r * 0.22, mouthY + r * 0.02);
    ctx.quadraticCurveTo(geo.headCenter.x + r * 0.03, mouthY - r * 0.14, geo.headCenter.x + r * 0.26, mouthY + r * 0.02);
  }
  ctx.stroke();

  if (face.hasFreckles) {
    const f = r * 0.03;
    ctx.beginPath();
    ctx.arc(geo.headCenter.x - r * 0.23, geo.headCenter.y + r * 0.08, f, 0, Math.PI * 2);
    ctx.arc(geo.headCenter.x - r * 0.16, geo.headCenter.y + r * 0.13, f, 0, Math.PI * 2);
    ctx.arc(geo.headCenter.x + r * 0.23, geo.headCenter.y + r * 0.08, f, 0, Math.PI * 2);
    ctx.arc(geo.headCenter.x + r * 0.16, geo.headCenter.y + r * 0.13, f, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.beginPath();
  const topY = geo.headCenter.y - r * 0.98;
  if (face.hair === 'short') {
    ctx.arc(geo.headCenter.x, geo.headCenter.y - r * 0.03, r * 0.98, 1.05 * Math.PI, 1.95 * Math.PI);
  }
  if (face.hair === 'long') {
    ctx.arc(geo.headCenter.x, geo.headCenter.y - r * 0.05, r * 1.04, 1.02 * Math.PI, 1.98 * Math.PI);
    ctx.moveTo(geo.headCenter.x - r * 0.92, geo.headCenter.y - r * 0.1);
    ctx.lineTo(geo.headCenter.x - r * 0.86, geo.headCenter.y + r * 0.75);
    ctx.moveTo(geo.headCenter.x + r * 0.92, geo.headCenter.y - r * 0.1);
    ctx.lineTo(geo.headCenter.x + r * 0.86, geo.headCenter.y + r * 0.75);
  }
  if (face.hair === 'spiky') {
    for (let i = -3; i <= 3; i++) {
      const x = geo.headCenter.x + i * (r * 0.24);
      ctx.moveTo(x - r * 0.09, topY + r * 0.14);
      ctx.lineTo(x, topY - r * 0.22 - Math.abs(i) * r * 0.02);
      ctx.lineTo(x + r * 0.09, topY + r * 0.14);
    }
  }
  if (face.hair === 'buns') {
    ctx.arc(geo.headCenter.x, geo.headCenter.y - r * 0.05, r * 0.95, 1.08 * Math.PI, 1.92 * Math.PI);
    ctx.moveTo(geo.headCenter.x - r * 1.05, geo.headCenter.y - r * 0.7);
    ctx.arc(geo.headCenter.x - r * 1.05, geo.headCenter.y - r * 0.7, r * 0.23, 0, Math.PI * 2);
    ctx.moveTo(geo.headCenter.x + r * 1.05, geo.headCenter.y - r * 0.7);
    ctx.arc(geo.headCenter.x + r * 1.05, geo.headCenter.y - r * 0.7, r * 0.23, 0, Math.PI * 2);
  }
  if (face.hair === 'ponytail') {
    ctx.arc(geo.headCenter.x, geo.headCenter.y - r * 0.05, r * 0.96, 1.05 * Math.PI, 1.95 * Math.PI);
    ctx.moveTo(geo.headCenter.x + r * 0.92, geo.headCenter.y - r * 0.25);
    ctx.quadraticCurveTo(geo.headCenter.x + r * 1.45, geo.headCenter.y + r * 0.12, geo.headCenter.x + r * 0.95, geo.headCenter.y + r * 0.45);
  }
  if (face.hair === 'mohawk') {
    ctx.moveTo(geo.headCenter.x, topY + r * 0.2);
    ctx.lineTo(geo.headCenter.x, topY - r * 0.35);
    ctx.lineTo(geo.headCenter.x, topY + r * 0.2);
  }
  if (face.hair === 'messy') {
    for (let i = -2; i <= 2; i++) {
      const x = geo.headCenter.x + i * r * 0.32;
      ctx.moveTo(x - r * 0.14, topY + r * 0.18);
      ctx.quadraticCurveTo(x, topY - r * (0.22 + (i % 2 === 0 ? 0.12 : 0.04)), x + r * 0.14, topY + r * 0.18);
    }
  }
  ctx.stroke();

  if (face.hasMoustache) {
    const y = geo.headCenter.y + r * 0.2;
    ctx.beginPath();
    ctx.moveTo(geo.headCenter.x - r * 0.28, y);
    ctx.quadraticCurveTo(geo.headCenter.x - r * 0.1, y + r * 0.11, geo.headCenter.x, y);
    ctx.quadraticCurveTo(geo.headCenter.x + r * 0.1, y + r * 0.11, geo.headCenter.x + r * 0.28, y);
    ctx.stroke();
  }

  if (face.hasBeard) {
    ctx.beginPath();
    ctx.arc(geo.headCenter.x, geo.headCenter.y + r * 0.16, r * 0.63, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }
}

function drawStickmanShape(stickman) {
  const g = buildStickmanGeometry(stickman.headCenter, stickman.scalePoint, stickman.pose || 'run');
  ctx.beginPath();
  ctx.arc(g.headCenter.x, g.headCenter.y, g.headRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(g.neck.x, g.neck.y);
  ctx.lineTo(g.pelvis.x, g.pelvis.y);
  ctx.moveTo(g.shoulder.x, g.shoulder.y);
  ctx.lineTo(g.leftHand.x, g.leftHand.y);
  ctx.moveTo(g.shoulder.x, g.shoulder.y);
  ctx.lineTo(g.rightHand.x, g.rightHand.y);
  ctx.moveTo(g.pelvis.x, g.pelvis.y);
  ctx.lineTo(g.leftFoot.x, g.leftFoot.y);
  ctx.moveTo(g.pelvis.x, g.pelvis.y);
  ctx.lineTo(g.rightFoot.x, g.rightFoot.y);
  ctx.stroke();

  drawStickmanFace(g, getStickmanFace(stickman));
}

function stickmanDistanceToPoint(stickman, pt) {
  const g = buildStickmanGeometry(stickman.headCenter, stickman.scalePoint, stickman.pose || 'run');
  let best = Math.abs(distance(g.headCenter, pt) - g.headRadius);
  const segments = [
    [g.neck, g.pelvis],
    [g.shoulder, g.leftHand],
    [g.shoulder, g.rightHand],
    [g.pelvis, g.leftFoot],
    [g.pelvis, g.rightFoot],
  ];
  for (const [a, b] of segments) {
    best = Math.min(best, segmentDistanceToPoint(a, b, pt));
  }
  return best;
}

function bezierDistanceToPoint(bezier, pt) {
  let best = Infinity;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const s = cubicBezierPoint(bezier.p0, bezier.p1, bezier.p2, bezier.p3, t);
    best = Math.min(best, distance(s, pt));
  }
  return best;
}

function toCanvasCoords(event) {
  const rect = canvas.getBoundingClientRect();
  const raw = {
    x: ((event.clientX - rect.left) * canvas.width) / rect.width,
    y: ((event.clientY - rect.top) * canvas.height) / rect.height,
  };
  if (!snapGridEl.checked) return raw;
  const g = state.gridSize;
  return {
    x: Math.round(raw.x / g) * g,
    y: Math.round(raw.y / g) * g,
  };
}

function drawGrid() {
  if (!showGridEl.checked) return;
  const step = state.gridSize;
  ctx.save();
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function getEntityById(id) {
  return state.entities.find((entity) => entity.id === id);
}

function getPointByEntity(entity) {
  if (!entity || entity.type !== 'point') return null;
  return { x: entity.x, y: entity.y };
}

function drawPoint(p, selected = false) {
  ctx.save();
  ctx.fillStyle = selected ? '#fbbf24' : p.color || '#22d3ee';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEntity(entity, selected = false) {
  ctx.save();
  const entityColor = getEntityColor(entity);
  ctx.strokeStyle = selected ? '#fbbf24' : entityColor;
  ctx.fillStyle = selected ? '#fbbf24' : entityColor;
  ctx.lineWidth = selected ? 2.5 : 1.8;

  if (entity.type === 'point') {
    drawPoint({ ...entity, color: entityColor }, selected);
  }

  if (entity.type === 'line') {
    ctx.beginPath();
    ctx.moveTo(entity.a.x, entity.a.y);
    ctx.lineTo(entity.b.x, entity.b.y);
    ctx.stroke();
  }

  if (entity.type === 'circle') {
    ctx.beginPath();
    ctx.arc(entity.c.x, entity.c.y, entity.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (entity.type === 'arc') {
    ctx.beginPath();
    ctx.arc(entity.c.x, entity.c.y, entity.r, entity.a0, entity.a1, entity.ccw);
    ctx.stroke();
  }

  if (entity.type === 'ellipse' || entity.type === 'ellipticArc') {
    const end = entity.type === 'ellipse' ? Math.PI * 2 : entity.a1;
    const start = entity.type === 'ellipse' ? 0 : entity.a0;
    ctx.beginPath();
    ctx.ellipse(entity.c.x, entity.c.y, entity.rx, entity.ry, entity.rotation, start, end, entity.ccw || false);
    ctx.stroke();
  }

  if (entity.type === 'bezier') {
    ctx.beginPath();
    ctx.moveTo(entity.p0.x, entity.p0.y);
    ctx.bezierCurveTo(entity.p1.x, entity.p1.y, entity.p2.x, entity.p2.y, entity.p3.x, entity.p3.y);
    ctx.stroke();
    if (selected) {
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(entity.p0.x, entity.p0.y);
      ctx.lineTo(entity.p1.x, entity.p1.y);
      ctx.lineTo(entity.p2.x, entity.p2.y);
      ctx.lineTo(entity.p3.x, entity.p3.y);
      ctx.stroke();
      drawPoint(entity.p0, true);
      drawPoint(entity.p1, true);
      drawPoint(entity.p2, true);
      drawPoint(entity.p3, true);
      ctx.restore();
    }
  }

  if (entity.type === 'dragon') {
    const points = Array.isArray(entity.points)
      ? entity.points
      : dragonCurvePoints(entity.p0, entity.p1, entity.iterations || 10);
    if (points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    }
  }

  if (entity.type === 'stickman') {
    drawStickmanShape(entity);
    if (selected) {
      drawPoint(entity.headCenter, true);
      drawPoint(entity.scalePoint, true);
    }
  }

  ctx.restore();
}

function textAt(text, x, y) {
  ctx.save();
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawDimensions() {
  for (const dim of state.dimensions) {
    ctx.save();
    ctx.strokeStyle = '#86efac';
    ctx.lineWidth = 1.2;

    if (dim.type === 'length') {
      const line = getEntityById(dim.refId);
      if (!line || line.type !== 'line') continue;
      const mid = { x: (line.a.x + line.b.x) / 2, y: (line.a.y + line.b.y) / 2 };
      const len = distance(line.a, line.b).toFixed(2);
      textAt(`L=${len}`, mid.x + 8, mid.y - 8);
    }

    if (dim.type === 'radius') {
      const circle = getEntityById(dim.refId);
      if (!circle || (circle.type !== 'circle' && circle.type !== 'arc')) continue;
      ctx.beginPath();
      ctx.moveTo(circle.c.x, circle.c.y);
      ctx.lineTo(circle.c.x + circle.r, circle.c.y);
      ctx.stroke();
      textAt(`R=${circle.r.toFixed(2)}`, circle.c.x + circle.r + 6, circle.c.y - 4);
    }

    if (dim.type === 'distance') {
      const p1 = getEntityById(dim.aId);
      const p2 = getEntityById(dim.bId);
      if (!p1 || !p2 || p1.type !== 'point' || p2.type !== 'point') continue;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      textAt(`D=${distance(p1, p2).toFixed(2)}`, mid.x + 6, mid.y + 12);
    }

    ctx.restore();
  }
}

function drawTempGeometry() {
  if (!tempPoints.length) return;
  ctx.save();
  ctx.strokeStyle = '#38bdf8';
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1.2;

  for (const p of tempPoints) {
    drawPoint(p, false);
  }

  if (currentTool === 'line' && tempPoints.length === 1) {
    ctx.beginPath();
    ctx.moveTo(tempPoints[0].x, tempPoints[0].y);
    ctx.lineTo(mouse.x, mouse.y);
    ctx.stroke();
  }

  if (currentTool === 'circle' && tempPoints.length === 1) {
    const radius = distance(tempPoints[0], mouse);
    ctx.beginPath();
    ctx.arc(tempPoints[0].x, tempPoints[0].y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  if ((currentTool === 'ellipse' || currentTool === 'ellipticArc') && tempPoints.length >= 1) {
    if (tempPoints.length === 1) {
      ctx.beginPath();
      ctx.moveTo(tempPoints[0].x, tempPoints[0].y);
      ctx.lineTo(mouse.x, mouse.y);
      ctx.stroke();
    }
    if (tempPoints.length === 2) {
      const c = tempPoints[0];
      const major = tempPoints[1];
      const rx = Math.max(1, distance(c, major));
      const rotation = angle(c, major);
      const ry = Math.max(1, distance(c, mouse));
      const start = currentTool === 'ellipticArc' ? 0 : 0;
      const end = currentTool === 'ellipticArc' ? angle(c, mouse) : Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, rx, ry, rotation, start, end, false);
      ctx.stroke();
    }
  }

  if (currentTool === 'bezier') {
    if (tempPoints.length === 1) {
      ctx.beginPath();
      ctx.moveTo(tempPoints[0].x, tempPoints[0].y);
      ctx.lineTo(mouse.x, mouse.y);
      ctx.stroke();
    }
    if (tempPoints.length === 2) {
      ctx.beginPath();
      ctx.moveTo(tempPoints[0].x, tempPoints[0].y);
      ctx.lineTo(tempPoints[1].x, tempPoints[1].y);
      ctx.lineTo(mouse.x, mouse.y);
      ctx.stroke();
    }
    if (tempPoints.length === 3) {
      const p0 = tempPoints[0];
      const p1 = tempPoints[1];
      const p2 = tempPoints[2];
      const p3 = mouse;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.stroke();
    }
  }

  if (currentTool === 'dragon') {
    if (tempPoints.length === 1) {
      const iterations = Math.max(1, Math.min(16, Number(dragonIterationsEl.value) || 10));
      const previewPoints = dragonCurvePoints(tempPoints[0], mouse, iterations);
      if (previewPoints.length > 1) {
        ctx.beginPath();
        ctx.moveTo(previewPoints[0].x, previewPoints[0].y);
        for (let i = 1; i < previewPoints.length; i++) {
          ctx.lineTo(previewPoints[i].x, previewPoints[i].y);
        }
        ctx.stroke();
      }
    }
  }

  if (currentTool === 'stickman' && tempPoints.length === 1) {
    const selectedPose = stickmanPoseEl?.value || 'random';
    drawStickmanShape({
      headCenter: tempPoints[0],
      scalePoint: mouse,
      pose: selectedPose === 'random' ? 'run' : selectedPose,
    });
  }

  ctx.restore();
}

function renderEntityList() {
  entityList.innerHTML = '';
  for (const e of state.entities) {
    const li = document.createElement('li');
    li.textContent = `${e.id}: ${e.type}`;
    if (state.selected.includes(e.id)) li.style.borderColor = '#fbbf24';
    entityList.appendChild(li);
  }
}

function renderDimensionList() {
  dimensionList.innerHTML = '';
  for (const d of state.dimensions) {
    const li = document.createElement('li');
    li.textContent = `${d.id}: ${d.type}`;
    dimensionList.appendChild(li);
  }
}

function renderConstraintList() {
  constraintList.innerHTML = '';
  for (const c of state.constraints) {
    const li = document.createElement('li');
    li.textContent = `${c.id}: ${c.type}`;
    constraintList.appendChild(li);
  }
}

function updateSelectionInfo() {
  if (!state.selected.length) {
    selectionInfo.textContent = 'Nothing selected';
    return;
  }
  const selectedEntities = state.selected.map((id) => getEntityById(id)).filter(Boolean);
  selectionInfo.textContent = selectedEntities.map((entity) => `${entity.id} (${entity.type})`).join(', ');
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  for (const entity of state.entities) {
    drawEntity(entity, state.selected.includes(entity.id));
  }
  drawDimensions();
  drawTempGeometry();
  renderEntityList();
  renderDimensionList();
  renderConstraintList();
  updateSelectionInfo();
}

function hitPoint(point, x, y, eps = 8) {
  return distance(point, { x, y }) <= eps;
}

function nearestEntity(x, y) {
  let best = null;
  let bestDist = Infinity;

  for (const e of state.entities) {
    let d = Infinity;

    if (e.type === 'point') {
      d = distance(e, { x, y });
    } else if (e.type === 'line') {
      const A = e.a;
      const B = e.b;
      const vx = B.x - A.x;
      const vy = B.y - A.y;
      const len2 = vx * vx + vy * vy;
      if (len2 > 0) {
        const t = Math.max(0, Math.min(1, ((x - A.x) * vx + (y - A.y) * vy) / len2));
        const proj = { x: A.x + t * vx, y: A.y + t * vy };
        d = distance(proj, { x, y });
      }
    } else if (e.type === 'circle') {
      d = Math.abs(distance(e.c, { x, y }) - e.r);
    } else if (e.type === 'arc') {
      d = Math.abs(distance(e.c, { x, y }) - e.r);
    } else if (e.type === 'ellipse' || e.type === 'ellipticArc') {
      d = distance(e.c, { x, y }) / Math.max(e.rx, e.ry);
      d = Math.abs(d - 1) * Math.max(e.rx, e.ry);
    } else if (e.type === 'bezier') {
      d = bezierDistanceToPoint(e, { x, y });
    } else if (e.type === 'dragon') {
      const points = Array.isArray(e.points) ? e.points : dragonCurvePoints(e.p0, e.p1, e.iterations || 10);
      d = polylineDistanceToPoint(points, { x, y });
    } else if (e.type === 'stickman') {
      d = stickmanDistanceToPoint(e, { x, y });
    }

    if (d < bestDist) {
      best = e;
      bestDist = d;
    }
  }

  return bestDist <= 12 ? best : null;
}

function computeCircleFrom3Points(p1, p2, p3) {
  const a = p2.x - p1.x;
  const b = p2.y - p1.y;
  const c = p3.x - p1.x;
  const d = p3.y - p1.y;
  const e = a * (p1.x + p2.x) + b * (p1.y + p2.y);
  const f = c * (p1.x + p3.x) + d * (p1.y + p3.y);
  const g = 2 * (a * (p3.y - p2.y) - b * (p3.x - p2.x));
  if (Math.abs(g) < 1e-9) return null;
  const cx = (d * e - b * f) / g;
  const cy = (a * f - c * e) / g;
  const center = { x: cx, y: cy };
  return {
    c: center,
    r: distance(center, p1),
    a0: angle(center, p1),
    a1: angle(center, p3),
    ccw: true,
  };
}

function setTool(tool) {
  currentTool = tool;
  tempPoints = [];
  moveDrag.active = false;
  moveDrag.entityId = null;
  moveDrag.last = null;
  toolButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tool === tool));
  statusbar.textContent = `Tool: ${tool}`;
  canvas.style.cursor = tool === 'select' ? 'default' : tool === 'move' ? 'grab' : 'crosshair';
}

function addEntity(entity) {
  if (!entity.color) {
    entity.color = randomEntityColor();
  }
  state.entities.push(entity);
}

function translateEntity(entity, dx, dy) {
  if (!entity) return;
  if (entity.type === 'point') {
    entity.x += dx;
    entity.y += dy;
  }
  if (entity.type === 'line') {
    entity.a.x += dx;
    entity.a.y += dy;
    entity.b.x += dx;
    entity.b.y += dy;
  }
  if (entity.type === 'circle' || entity.type === 'arc') {
    entity.c.x += dx;
    entity.c.y += dy;
  }
  if (entity.type === 'ellipse' || entity.type === 'ellipticArc') {
    entity.c.x += dx;
    entity.c.y += dy;
  }
  if (entity.type === 'bezier') {
    entity.p0.x += dx;
    entity.p0.y += dy;
    entity.p1.x += dx;
    entity.p1.y += dy;
    entity.p2.x += dx;
    entity.p2.y += dy;
    entity.p3.x += dx;
    entity.p3.y += dy;
  }
  if (entity.type === 'dragon') {
    entity.p0.x += dx;
    entity.p0.y += dy;
    entity.p1.x += dx;
    entity.p1.y += dy;
    if (Array.isArray(entity.points)) {
      for (const p of entity.points) {
        p.x += dx;
        p.y += dy;
      }
    }
  }
  if (entity.type === 'stickman') {
    entity.headCenter.x += dx;
    entity.headCenter.y += dy;
    entity.scalePoint.x += dx;
    entity.scalePoint.y += dy;
  }
}

function addPointEntity(p) {
  addEntity({ id: nextId('point'), type: 'point', x: p.x, y: p.y });
}

function handleSelectClick(p) {
  const entity = nearestEntity(p.x, p.y);
  if (!entity) {
    state.selected = [];
    return;
  }
  if (window.event && (window.event.ctrlKey || window.event.metaKey)) {
    if (state.selected.includes(entity.id)) {
      state.selected = state.selected.filter((id) => id !== entity.id);
    } else {
      state.selected.push(entity.id);
    }
  } else {
    state.selected = [entity.id];
  }
}

function commitDimensionByTool() {
  if (currentTool === 'dimLength') {
    const e = state.selected.map(getEntityById).find((item) => item && item.type === 'line');
    if (!e) {
      alert('Select one line first.');
      return;
    }
    state.dimensions.push({ id: nextId('dim'), type: 'length', refId: e.id });
  }

  if (currentTool === 'dimRadius') {
    const e = state.selected
      .map(getEntityById)
      .find((item) => item && (item.type === 'circle' || item.type === 'arc'));
    if (!e) {
      alert('Select one circle or arc first.');
      return;
    }
    state.dimensions.push({ id: nextId('dim'), type: 'radius', refId: e.id });
  }

  if (currentTool === 'dimDistance') {
    const pts = state.selected.map(getEntityById).filter((item) => item && item.type === 'point');
    if (pts.length < 2) {
      alert('Select two points first.');
      return;
    }
    state.dimensions.push({ id: nextId('dim'), type: 'distance', aId: pts[0].id, bId: pts[1].id });
  }
}

function solveConstraints(iterations = 3) {
  for (let i = 0; i < iterations; i++) {
    for (const c of state.constraints) {
      if (c.type === 'horizontal') {
        const line = getEntityById(c.lineId);
        if (!line || line.type !== 'line') continue;
        const y = (line.a.y + line.b.y) / 2;
        line.a.y = y;
        line.b.y = y;
      }

      if (c.type === 'vertical') {
        const line = getEntityById(c.lineId);
        if (!line || line.type !== 'line') continue;
        const x = (line.a.x + line.b.x) / 2;
        line.a.x = x;
        line.b.x = x;
      }

      if (c.type === 'equalLength') {
        const l1 = getEntityById(c.lineAId);
        const l2 = getEntityById(c.lineBId);
        if (!l1 || !l2 || l1.type !== 'line' || l2.type !== 'line') continue;
        const target = distance(l1.a, l1.b);
        const dir = {
          x: l2.b.x - l2.a.x,
          y: l2.b.y - l2.a.y,
        };
        const len = Math.hypot(dir.x, dir.y) || 1;
        const ux = dir.x / len;
        const uy = dir.y / len;
        l2.b.x = l2.a.x + ux * target;
        l2.b.y = l2.a.y + uy * target;
      }

      if (c.type === 'coincident') {
        const p1 = getEntityById(c.pointAId);
        const p2 = getEntityById(c.pointBId);
        if (!p1 || !p2 || p1.type !== 'point' || p2.type !== 'point') continue;
        const x = (p1.x + p2.x) / 2;
        const y = (p1.y + p2.y) / 2;
        p1.x = x;
        p1.y = y;
        p2.x = x;
        p2.y = y;
      }

      if (c.type === 'pointOnCircle') {
        const p = getEntityById(c.pointId);
        const circ = getEntityById(c.circleId);
        if (!p || !circ || p.type !== 'point' || circ.type !== 'circle') continue;
        const ang = angle(circ.c, p);
        p.x = circ.c.x + Math.cos(ang) * circ.r;
        p.y = circ.c.y + Math.sin(ang) * circ.r;
      }
    }
  }
}

function applyConstraintFromSelection() {
  const type = constraintTypeEl.value;
  const selectedEntities = state.selected.map(getEntityById).filter(Boolean);

  if (type === 'horizontal') {
    const line = selectedEntities.find((e) => e.type === 'line');
    if (!line) return alert('Select one line.');
    state.constraints.push({ id: nextId('c'), type: 'horizontal', lineId: line.id });
  }

  if (type === 'vertical') {
    const line = selectedEntities.find((e) => e.type === 'line');
    if (!line) return alert('Select one line.');
    state.constraints.push({ id: nextId('c'), type: 'vertical', lineId: line.id });
  }

  if (type === 'equalLength') {
    const lines = selectedEntities.filter((e) => e.type === 'line');
    if (lines.length < 2) return alert('Select two lines.');
    state.constraints.push({
      id: nextId('c'),
      type: 'equalLength',
      lineAId: lines[0].id,
      lineBId: lines[1].id,
    });
  }

  if (type === 'coincident') {
    const points = selectedEntities.filter((e) => e.type === 'point');
    if (points.length < 2) return alert('Select two points.');
    state.constraints.push({
      id: nextId('c'),
      type: 'coincident',
      pointAId: points[0].id,
      pointBId: points[1].id,
    });
  }

  if (type === 'pointOnCircle') {
    const point = selectedEntities.find((e) => e.type === 'point');
    const circle = selectedEntities.find((e) => e.type === 'circle');
    if (!point || !circle) return alert('Select one point and one circle.');
    state.constraints.push({ id: nextId('c'), type: 'pointOnCircle', pointId: point.id, circleId: circle.id });
  }

  solveConstraints();
}

function onCanvasClick(event) {
  const p = toCanvasCoords(event);

  if (currentTool === 'move') {
    return;
  }

  if (currentTool === 'select') {
    handleSelectClick(p);
    render();
    return;
  }

  if (currentTool === 'point') {
    addPointEntity(p);
    render();
    return;
  }

  if (currentTool === 'line') {
    tempPoints.push(p);
    if (tempPoints.length === 2) {
      addEntity({ id: nextId('line'), type: 'line', a: tempPoints[0], b: tempPoints[1] });
      tempPoints = [];
      solveConstraints();
    }
    render();
    return;
  }

  if (currentTool === 'circle') {
    tempPoints.push(p);
    if (tempPoints.length === 2) {
      addEntity({ id: nextId('circle'), type: 'circle', c: tempPoints[0], r: distance(tempPoints[0], tempPoints[1]) });
      tempPoints = [];
      solveConstraints();
    }
    render();
    return;
  }

  if (currentTool === 'arc') {
    tempPoints.push(p);
    if (tempPoints.length === 3) {
      const arc = computeCircleFrom3Points(tempPoints[0], tempPoints[1], tempPoints[2]);
      if (arc) {
        addEntity({ id: nextId('arc'), type: 'arc', ...arc });
      }
      tempPoints = [];
      solveConstraints();
    }
    render();
    return;
  }

  if (currentTool === 'ellipse') {
    tempPoints.push(p);
    if (tempPoints.length === 3) {
      const c = tempPoints[0];
      const major = tempPoints[1];
      const third = tempPoints[2];
      addEntity({
        id: nextId('ellipse'),
        type: 'ellipse',
        c,
        rx: Math.max(1, distance(c, major)),
        ry: Math.max(1, distance(c, third)),
        rotation: angle(c, major),
      });
      tempPoints = [];
      solveConstraints();
    }
    render();
    return;
  }

  if (currentTool === 'ellipticArc') {
    tempPoints.push(p);
    if (tempPoints.length === 4) {
      const c = tempPoints[0];
      const major = tempPoints[1];
      const minor = tempPoints[2];
      const end = tempPoints[3];
      addEntity({
        id: nextId('earc'),
        type: 'ellipticArc',
        c,
        rx: Math.max(1, distance(c, major)),
        ry: Math.max(1, distance(c, minor)),
        rotation: angle(c, major),
        a0: normalizeAngle(angle(c, major)),
        a1: normalizeAngle(angle(c, end)),
        ccw: false,
      });
      tempPoints = [];
      solveConstraints();
    }
    render();
    return;
  }

  if (currentTool === 'bezier') {
    tempPoints.push(p);
    if (tempPoints.length === 4) {
      addEntity({
        id: nextId('bezier'),
        type: 'bezier',
        p0: tempPoints[0],
        p1: tempPoints[1],
        p2: tempPoints[2],
        p3: tempPoints[3],
      });
      tempPoints = [];
      solveConstraints();
    }
    render();
    return;
  }

  if (currentTool === 'dragon') {
    tempPoints.push(p);
    if (tempPoints.length === 2) {
      const iterations = Math.max(1, Math.min(16, Number(dragonIterationsEl.value) || 10));
      addEntity({
        id: nextId('dragon'),
        type: 'dragon',
        p0: tempPoints[0],
        p1: tempPoints[1],
        iterations,
        points: dragonCurvePoints(tempPoints[0], tempPoints[1], iterations),
      });
      tempPoints = [];
      solveConstraints();
    }
    render();
    return;
  }

  if (currentTool === 'stickman') {
    tempPoints.push(p);
    if (tempPoints.length === 2) {
      const requestedPose = stickmanPoseEl?.value || 'random';
      const pose = requestedPose === 'random' ? randomPick(['run', 'jump', 'sit', 'lie', 'fly']) : requestedPose;
      addEntity({
        id: nextId('stickman'),
        type: 'stickman',
        headCenter: tempPoints[0],
        scalePoint: tempPoints[1],
        pose,
        face: generateFunnyFace(),
      });
      tempPoints = [];
      solveConstraints();
    }
    render();
    return;
  }

  if (currentTool.startsWith('dim')) {
    commitDimensionByTool();
    render();
  }
}

function handleSave() {
  const payload = {
    version: 1,
    savedAt: new Date().toISOString(),
    model: {
      entities: state.entities,
      dimensions: state.dimensions,
      constraints: state.constraints,
      idCounter: state.idCounter,
    },
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'aicad-drawing.json';
  a.click();
  URL.revokeObjectURL(url);
}

function handleLoadFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || '{}'));
      const model = data.model;
      if (!model || !Array.isArray(model.entities) || !Array.isArray(model.dimensions) || !Array.isArray(model.constraints)) {
        throw new Error('Invalid format');
      }
      state.entities = model.entities;
      state.dimensions = model.dimensions;
      state.constraints = model.constraints;
      state.idCounter = Number(model.idCounter) || 1;
      state.selected = [];
      tempPoints = [];
      solveConstraints();
      render();
    } catch (err) {
      alert(`Failed to load JSON: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

function resetDocument() {
  state.entities = [];
  state.dimensions = [];
  state.constraints = [];
  state.selected = [];
  state.idCounter = 1;
  tempPoints = [];
  render();
}

function resizeCanvasToContainer() {
  const wrap = document.querySelector('.canvas-wrap');
  const rect = wrap.getBoundingClientRect();
  canvas.width = Math.max(600, Math.floor(rect.width));
  canvas.height = Math.max(400, Math.floor(rect.height));
  render();
}

for (const btn of toolButtons) {
  btn.addEventListener('click', () => setTool(btn.dataset.tool));
}

canvas.addEventListener('mousemove', (event) => {
  mouse = toCanvasCoords(event);
  if (currentTool === 'move' && moveDrag.active && moveDrag.entityId) {
    const entity = getEntityById(moveDrag.entityId);
    if (entity && moveDrag.last) {
      const dx = mouse.x - moveDrag.last.x;
      const dy = mouse.y - moveDrag.last.y;
      translateEntity(entity, dx, dy);
      moveDrag.last = { x: mouse.x, y: mouse.y };
      render();
      return;
    }
  }
  if (tempPoints.length) render();
});

canvas.addEventListener('mousedown', (event) => {
  if (currentTool !== 'move') return;
  const p = toCanvasCoords(event);
  const entity = nearestEntity(p.x, p.y);
  if (!entity) {
    state.selected = [];
    render();
    return;
  }
  state.selected = [entity.id];
  moveDrag.active = true;
  moveDrag.entityId = entity.id;
  moveDrag.last = p;
  canvas.style.cursor = 'grabbing';
  render();
});

canvas.addEventListener('mouseup', () => {
  if (!moveDrag.active) return;
  moveDrag.active = false;
  moveDrag.entityId = null;
  moveDrag.last = null;
  canvas.style.cursor = currentTool === 'move' ? 'grab' : canvas.style.cursor;
  solveConstraints();
  render();
});

canvas.addEventListener('mouseleave', () => {
  if (!moveDrag.active) return;
  moveDrag.active = false;
  moveDrag.entityId = null;
  moveDrag.last = null;
  canvas.style.cursor = currentTool === 'move' ? 'grab' : canvas.style.cursor;
  solveConstraints();
  render();
});

canvas.addEventListener('click', onCanvasClick);
showGridEl.addEventListener('change', render);
snapGridEl.addEventListener('change', render);
applyConstraintBtn.addEventListener('click', () => {
  applyConstraintFromSelection();
  render();
});

newDocBtn.addEventListener('click', () => {
  if (confirm('Clear current drawing?')) resetDocument();
});

saveBtn.addEventListener('click', handleSave);

loadInput.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (file) handleLoadFile(file);
  loadInput.value = '';
});

window.addEventListener('resize', resizeCanvasToContainer);

resizeCanvasToContainer();
render();
