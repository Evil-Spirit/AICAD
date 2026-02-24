// Main application class
class CADApp {
    constructor() {
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentTool = 'select';
        this.drawingObjects = [];
        this.tempPoints = [];
        this.isDrawing = false;
        this.snapDistance = 10; // pixels for snapping
        
        this.initCanvas();
        this.setupEventListeners();
        this.updateStatusBar();
    }

    initCanvas() {
        // Set canvas size to match its display size
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    setupEventListeners() {
        // Tool selection
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectTool(e.target.dataset.tool);
            });
        });

        // File operations
        document.getElementById('saveBtn').addEventListener('click', () => this.saveFile());
        document.getElementById('loadBtn').addEventListener('click', () => document.getElementById('fileInput').click());
        document.getElementById('fileInput').addEventListener('change', (e) => this.loadFile(e));

        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));

        // Window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    selectTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
        this.updateStatusBar();
    }

    updateStatusBar() {
        document.getElementById('currentTool').textContent = `Current Tool: ${this.capitalizeFirstLetter(this.currentTool)}`;
    }

    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    handleResize() {
        this.initCanvas();
        this.redraw();
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        switch(this.currentTool) {
            case 'select':
                this.handleSelect(x, y);
                break;
            case 'point':
                this.createPoint(x, y);
                break;
            case 'line':
                if (this.tempPoints.length === 0) {
                    this.tempPoints.push({x, y});
                } else if (this.tempPoints.length === 1) {
                    this.tempPoints.push({x, y});
                    this.createLine(this.tempPoints[0], this.tempPoints[1]);
                    this.tempPoints = [];
                }
                break;
            case 'circle':
                if (this.tempPoints.length === 0) {
                    this.tempPoints.push({x, y}); // Center
                } else if (this.tempPoints.length === 1) {
                    const radius = Math.sqrt(Math.pow(x - this.tempPoints[0].x, 2) + Math.pow(y - this.tempPoints[0].y, 2));
                    this.createCircle(this.tempPoints[0], radius);
                    this.tempPoints = [];
                }
                break;
            case 'arc':
                if (this.tempPoints.length < 3) {
                    this.tempPoints.push({x, y});
                    if (this.tempPoints.length === 3) {
                        this.createArc(this.tempPoints[0], this.tempPoints[1], this.tempPoints[2]);
                        this.tempPoints = [];
                    }
                }
                break;
            case 'ellipse':
                if (this.tempPoints.length === 0) {
                    this.tempPoints.push({x, y}); // Center
                } else if (this.tempPoints.length === 1) {
                    this.tempPoints.push({x, y}); // Point on ellipse
                    const rx = Math.abs(x - this.tempPoints[0].x);
                    const ry = Math.abs(y - this.tempPoints[0].y);
                    this.createEllipse(this.tempPoints[0], rx, ry);
                    this.tempPoints = [];
                }
                break;
            case 'ellipticArc':
                if (this.tempPoints.length < 4) {
                    this.tempPoints.push({x, y});
                    if (this.tempPoints.length === 4) {
                        this.createEllipticArc(
                            this.tempPoints[0], // center
                            this.tempPoints[1], // radii
                            this.tempPoints[2], // start angle point
                            this.tempPoints[3]  // end angle point
                        );
                        this.tempPoints = [];
                    }
                }
                break;
            case 'dimension':
                if (this.tempPoints.length === 0) {
                    this.tempPoints.push({x, y});
                } else if (this.tempPoints.length === 1) {
                    this.tempPoints.push({x, y});
                    this.createDimension(this.tempPoints[0], this.tempPoints[1]);
                    this.tempPoints = [];
                }
                break;
            case 'constraint':
                // For simplicity, just add a constraint to the selected object
                this.addConstraint(x, y);
                break;
        }
        
        this.redraw();
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Update coordinates in status bar
        document.getElementById('coordinates').textContent = `X: ${Math.round(x)}, Y: ${Math.round(y)}`;

        // Draw temporary elements while drawing
        if ((this.currentTool === 'line' || this.currentTool === 'circle' || this.currentTool === 'arc' || 
             this.currentTool === 'ellipse' || this.currentTool === 'ellipticArc') && this.tempPoints.length > 0) {
            
            // Create a temporary copy of the canvas to draw preview
            const tempCtx = this.ctx;
            this.redraw(); // Redraw existing objects
            
            switch(this.currentTool) {
                case 'line':
                    if (this.tempPoints.length === 1) {
                        this.drawTemporaryLine(this.tempPoints[0], {x, y});
                    }
                    break;
                case 'circle':
                    if (this.tempPoints.length === 1) {
                        const radius = Math.sqrt(Math.pow(x - this.tempPoints[0].x, 2) + Math.pow(y - this.tempPoints[0].y, 2));
                        this.drawTemporaryCircle(this.tempPoints[0], radius);
                    }
                    break;
                case 'ellipse':
                    if (this.tempPoints.length === 1) {
                        const rx = Math.abs(x - this.tempPoints[0].x);
                        const ry = Math.abs(y - this.tempPoints[0].y);
                        this.drawTemporaryEllipse(this.tempPoints[0], rx, ry);
                    }
                    break;
                case 'arc':
                    if (this.tempPoints.length === 2) {
                        // For arc preview, we'll just draw a line for now
                        this.drawTemporaryLine(this.tempPoints[0], {x, y});
                    }
                    break;
                case 'ellipticArc':
                    if (this.tempPoints.length === 3) {
                        this.drawTemporaryLine(this.tempPoints[0], {x, y});
                    }
                    break;
            }
        }
    }

    handleMouseUp(e) {
        // Currently not needed for our implementation
    }

    handleDoubleClick(e) {
        // Cancel current drawing operation on double click
        if (this.tempPoints.length > 0) {
            this.tempPoints = [];
            this.redraw();
        }
    }

    handleSelect(x, y) {
        // Simple selection - find object at position (x, y)
        for (let i = this.drawingObjects.length - 1; i >= 0; i--) {
            const obj = this.drawingObjects[i];
            if (this.isPointOnObject(x, y, obj)) {
                obj.selected = !obj.selected;
                break; // Select only the topmost object
            }
        }
        this.redraw();
    }

    isPointOnObject(x, y, obj) {
        // Check if point (x,y) is close to the object
        switch(obj.type) {
            case 'point':
                return Math.sqrt(Math.pow(x - obj.x, 2) + Math.pow(y - obj.y, 2)) < 10;
            case 'line':
                return this.isPointOnLine(x, y, obj);
            case 'circle':
                // Check if point is on circle edge (within tolerance)
                const distanceFromCenter = Math.sqrt(Math.pow(x - obj.center.x, 2) + Math.pow(y - obj.center.y, 2));
                return Math.abs(distanceFromCenter - obj.radius) < 5;
            case 'arc':
                // Simplified check for arc
                const distFromCenter = Math.sqrt(Math.pow(x - obj.center.x, 2) + Math.pow(y - obj.center.y, 2));
                return Math.abs(distFromCenter - obj.radius) < 5;
            case 'ellipse':
                // Simplified check for ellipse
                const dx = x - obj.center.x;
                const dy = y - obj.center.y;
                const distance = Math.pow(dx/obj.rx, 2) + Math.pow(dy/obj.ry, 2);
                return Math.abs(distance - 1) < 0.1;
            default:
                return false;
        }
    }

    isPointOnLine(x, y, line) {
        // Calculate distance from point to line segment
        const A = x - line.start.x;
        const B = y - line.start.y;
        const C = line.end.x - line.start.x;
        const D = line.end.y - line.start.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) return Math.sqrt(A*A + B*B) < 5;
        
        const param = dot / lenSq;
        
        let xx, yy;
        
        if (param < 0) {
            xx = line.start.x;
            yy = line.start.y;
        } else if (param > 1) {
            xx = line.end.x;
            yy = line.end.y;
        } else {
            xx = line.start.x + param * C;
            yy = line.start.y + param * D;
        }
        
        const dx = x - xx;
        const dy = y - yy;
        return Math.sqrt(dx * dx + dy * dy) < 5;
    }

    createPoint(x, y) {
        const point = {
            type: 'point',
            x: x,
            y: y,
            selected: false
        };
        this.drawingObjects.push(point);
    }

    createLine(start, end) {
        const line = {
            type: 'line',
            start: {x: start.x, y: start.y},
            end: {x: end.x, y: end.y},
            selected: false
        };
        this.drawingObjects.push(line);
    }

    createCircle(center, radius) {
        const circle = {
            type: 'circle',
            center: {x: center.x, y: center.y},
            radius: radius,
            selected: false
        };
        this.drawingObjects.push(circle);
    }

    createArc(center, point1, point2) {
        // Calculate radius and angles
        const radius = Math.sqrt(Math.pow(point1.x - center.x, 2) + Math.pow(point1.y - center.y, 2));
        const startAngle = Math.atan2(point1.y - center.y, point1.x - center.x);
        const endAngle = Math.atan2(point2.y - center.y, point2.x - center.x);
        
        const arc = {
            type: 'arc',
            center: {x: center.x, y: center.y},
            radius: radius,
            startAngle: startAngle,
            endAngle: endAngle,
            selected: false
        };
        this.drawingObjects.push(arc);
    }

    createEllipse(center, rx, ry) {
        const ellipse = {
            type: 'ellipse',
            center: {x: center.x, y: center.y},
            rx: rx,
            ry: ry,
            selected: false
        };
        this.drawingObjects.push(ellipse);
    }

    createEllipticArc(center, radiiPoint, startPoint, endPoint) {
        const rx = Math.abs(radiiPoint.x - center.x);
        const ry = Math.abs(radiiPoint.y - center.y);
        
        const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
        const endAngle = Math.atan2(endPoint.y - center.y, endPoint.x - center.x);
        
        const ellipticArc = {
            type: 'ellipticArc',
            center: {x: center.x, y: center.y},
            rx: rx,
            ry: ry,
            startAngle: startAngle,
            endAngle: endAngle,
            selected: false
        };
        this.drawingObjects.push(ellipticArc);
    }

    createDimension(start, end) {
        const dimension = {
            type: 'dimension',
            start: {x: start.x, y: start.y},
            end: {x: end.x, y: end.y},
            selected: false
        };
        this.drawingObjects.push(dimension);
    }

    addConstraint(x, y) {
        // Find closest object to apply constraint to
        let minDist = Infinity;
        let closestObj = null;
        
        for (const obj of this.drawingObjects) {
            let dist;
            switch(obj.type) {
                case 'point':
                    dist = Math.sqrt(Math.pow(x - obj.x, 2) + Math.pow(y - obj.y, 2));
                    break;
                case 'line':
                    // Simplified distance calculation
                    dist = Math.min(
                        Math.sqrt(Math.pow(x - obj.start.x, 2) + Math.pow(y - obj.start.y, 2)),
                        Math.sqrt(Math.pow(x - obj.end.x, 2) + Math.pow(y - obj.end.y, 2))
                    );
                    break;
                default:
                    dist = Math.sqrt(Math.pow(x - (obj.center ? obj.center.x : 0), 2) + Math.pow(y - (obj.center ? obj.center.y : 0), 2));
            }
            
            if (dist < minDist) {
                minDist = dist;
                closestObj = obj;
            }
        }
        
        if (closestObj && minDist < 20) {
            if (!closestObj.constraints) closestObj.constraints = [];
            closestObj.constraints.push({
                type: 'fixed',
                description: 'Fixed position'
            });
        }
    }

    drawTemporaryLine(start, end) {
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.strokeStyle = '#999';
        this.ctx.setLineDash([5, 3]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    drawTemporaryCircle(center, radius) {
        this.ctx.beginPath();
        this.ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
        this.ctx.strokeStyle = '#999';
        this.ctx.setLineDash([5, 3]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    drawTemporaryEllipse(center, rx, ry) {
        this.ctx.beginPath();
        this.ctx.ellipse(center.x, center.y, rx, ry, 0, 0, 2 * Math.PI);
        this.ctx.strokeStyle = '#999';
        this.ctx.setLineDash([5, 3]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    redraw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.drawGrid();
        
        // Draw all objects
        for (const obj of this.drawingObjects) {
            this.drawObject(obj);
        }
    }

    drawGrid() {
        const gridSize = 20;
        this.ctx.strokeStyle = '#eee';
        this.ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = 0; x <= this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y <= this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    drawObject(obj) {
        this.ctx.lineWidth = obj.selected ? 3 : 1;
        this.ctx.strokeStyle = obj.selected ? '#007bff' : '#000';
        
        switch(obj.type) {
            case 'point':
                this.ctx.beginPath();
                this.ctx.arc(obj.x, obj.y, 3, 0, 2 * Math.PI);
                this.ctx.fillStyle = obj.selected ? '#007bff' : '#000';
                this.ctx.fill();
                break;
                
            case 'line':
                this.ctx.beginPath();
                this.ctx.moveTo(obj.start.x, obj.start.y);
                this.ctx.lineTo(obj.end.x, obj.end.y);
                this.ctx.stroke();
                break;
                
            case 'circle':
                this.ctx.beginPath();
                this.ctx.arc(obj.center.x, obj.center.y, obj.radius, 0, 2 * Math.PI);
                this.ctx.stroke();
                break;
                
            case 'arc':
                this.ctx.beginPath();
                this.ctx.arc(obj.center.x, obj.center.y, obj.radius, obj.startAngle, obj.endAngle);
                this.ctx.stroke();
                break;
                
            case 'ellipse':
                this.ctx.beginPath();
                this.ctx.ellipse(obj.center.x, obj.center.y, obj.rx, obj.ry, 0, 0, 2 * Math.PI);
                this.ctx.stroke();
                break;
                
            case 'ellipticArc':
                this.ctx.beginPath();
                this.ctx.ellipse(obj.center.x, obj.center.y, obj.rx, obj.ry, 0, obj.startAngle, obj.endAngle);
                this.ctx.stroke();
                break;
                
            case 'dimension':
                // Draw dimension line
                this.ctx.beginPath();
                this.ctx.moveTo(obj.start.x, obj.start.y);
                this.ctx.lineTo(obj.end.x, obj.end.y);
                this.ctx.strokeStyle = '#ff0000';
                this.ctx.stroke();
                
                // Draw extension lines
                this.ctx.strokeStyle = '#0000ff';
                this.ctx.beginPath();
                this.ctx.moveTo(obj.start.x, obj.start.y - 5);
                this.ctx.lineTo(obj.start.x, obj.start.y + 5);
                this.ctx.moveTo(obj.end.x, obj.end.y - 5);
                this.ctx.lineTo(obj.end.x, obj.end.y + 5);
                this.ctx.stroke();
                
                // Reset stroke style
                this.ctx.strokeStyle = obj.selected ? '#007bff' : '#000';
                break;
        }
        
        // Draw constraints if any
        if (obj.constraints && obj.constraints.length > 0) {
            // Draw small indicator for constraints
            const centerX = obj.center ? obj.center.x : (obj.start ? (obj.start.x + obj.end.x)/2 : obj.x);
            const centerY = obj.center ? obj.center.y : (obj.start ? (obj.start.y + obj.end.y)/2 : obj.y);
            
            this.ctx.fillStyle = '#ff0000';
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
            this.ctx.fill();
        }
        
        // Reset line width
        this.ctx.lineWidth = 1;
    }

    saveFile() {
        const data = {
            objects: this.drawingObjects,
            version: '1.0'
        };
        
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cad-drawing.json';
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    }

    loadFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.version && data.objects) {
                    this.drawingObjects = data.objects;
                    this.redraw();
                } else {
                    alert('Invalid file format');
                }
            } catch (error) {
                alert('Error reading file: ' + error.message);
            }
        };
        reader.readAsText(file);
        
        // Reset file input
        event.target.value = '';
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CADApp();
});