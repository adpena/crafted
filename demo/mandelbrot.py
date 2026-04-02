# Mandelbrot renderer for Molt → Wasm → Canvas demo
# Writes RGBA pixel data to stdout as raw bytes
# Parameters are tunable from the calling environment

WIDTH: int = 400
HEIGHT: int = 400
MAX_ITER: int = 80
CENTER_X: float = -0.5
CENTER_Y: float = 0.0
ZOOM: float = 1.0

def color(i: int, max_iter: int) -> tuple:
    if i == max_iter:
        return (0, 0, 0, 255)
    t: float = i / max_iter
    r: int = int(9.0 * (1.0 - t) * t * t * t * 255)
    g: int = int(15.0 * (1.0 - t) * (1.0 - t) * t * t * 255)
    b: int = int(8.5 * (1.0 - t) * (1.0 - t) * (1.0 - t) * t * 255)
    return (r, g, b, 255)

def render() -> None:
    scale: float = 3.0 / (ZOOM * WIDTH)
    pixels: list = []
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
            c = color(i, MAX_ITER)
            pixels.append(c[0])
            pixels.append(c[1])
            pixels.append(c[2])
            pixels.append(c[3])
            x = x + 1
        y = y + 1
    # Output dimensions then pixel data as space-separated integers
    print(WIDTH)
    print(HEIGHT)
    i: int = 0
    while i < len(pixels):
        print(pixels[i])
        i = i + 1

def main() -> None:
    render()

main()
