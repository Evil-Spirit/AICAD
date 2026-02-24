# AICAD

Lightweight online 2D CAD (HTML + JavaScript) for creating:
- points
- lines
- circles
- arcs
- ellipses
- elliptic arcs
- bezier splines
- dimensions
- constraints

Also supports saving and loading drawings in JSON format.

## Run

Any static server is enough. Example:

```bash
python3 -m http.server 8080
```

Open:

```text
http://localhost:8080
```

## Tools

- **Select**: click entity to select, Ctrl/Cmd+click for multi-select.
- **Point**: one click creates a point.
- **Line**: two clicks (start/end).
- **Circle**: two clicks (center + radius point).
- **Arc (3 pts)**: three clicks (start, middle, end).
- **Ellipse**: three clicks (center, major radius point, minor radius point).
- **Elliptic Arc**: four clicks (center, major radius point, minor radius point, end point).
- **Bezier Spline**: four clicks (start point, control point 1, control point 2, end point).

## Dimensions

- **Length**: select one line, then use `Length` tool and click canvas.
- **Radius**: select one circle/arc, then use `Radius` tool and click canvas.
- **Distance**: select two points, then use `Distance` tool and click canvas.

## Constraints

Select entities, choose constraint type, click **Apply on selected**.

Available constraints:
- Horizontal (line)
- Vertical (line)
- Equal Length (2 lines)
- Coincident (2 points)
- Point on Circle

## JSON format

Save creates file `aicad-drawing.json` with:
- `version`
- `savedAt`
- `model.entities`
- `model.dimensions`
- `model.constraints`
- `model.idCounter`
