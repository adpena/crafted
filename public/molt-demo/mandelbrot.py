# Mandelbrot set renderer — compiled by Molt to WebAssembly
# Edit parameters and recompile to see changes in real time

WIDTH: int = 400
HEIGHT: int = 300
MAX_ITER: int = 100
CENTER_X: float = -0.7463
CENTER_Y: float = 0.1102
ZOOM: float = 1.0

def render() -> None:
    scale: float = 3.0 / (ZOOM * WIDTH)
    y: int = 0
    while y < HEIGHT:
        x: int = 0
        while x < WIDTH:
            cr: float = CENTER_X + (x - WIDTH / 2) * scale
            ci: float = CENTER_Y + (y - HEIGHT / 2) * scale
            zr: float = 0.0
            zi: float = 0.0
            i: int = 0
            while i < MAX_ITER:
                tr: float = zr * zr - zi * zi + cr
                zi = 2.0 * zr * zi + ci
                zr = tr
                if zr * zr + zi * zi > 4.0:
                    break
                i = i + 1
            # Color: smooth gradient based on escape iteration
            if i == MAX_ITER:
                r: int = 0
                g: int = 0
                b: int = 0
            else:
                t: float = i / MAX_ITER
                r = int(9.0 * (1.0 - t) * t * t * t * 255)
                g = int(15.0 * (1.0 - t) * (1.0 - t) * t * t * 255)
                b = int(8.5 * (1.0 - t) * (1.0 - t) * (1.0 - t) * t * 255)
            # Output RGBA as space-separated: r g b 255
            print(r, g, b, 255)
            x = x + 1
        y = y + 1

def main() -> None:
    print(WIDTH, HEIGHT)
    render()

main()
