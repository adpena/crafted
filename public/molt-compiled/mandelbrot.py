# A fixed Mandelbrot view compiled by Molt for this browser exhibit.
# The program prints one ASCII row at a time; no browser-side fractal math.
y: int = 0
while y < 28:
    row: str = ""
    x: int = 0
    while x < 72:
        cr: float = -2.1 + x * 3.0 / 72
        ci: float = -1.1 + y * 2.2 / 28
        zr: float = 0.0
        zi: float = 0.0
        iteration: int = 0
        while zr * zr + zi * zi < 4.0 and iteration < 60:
            next_zr: float = zr * zr - zi * zi + cr
            zi = 2.0 * zr * zi + ci
            zr = next_zr
            iteration += 1
        if iteration == 60:
            row += "#"
        elif iteration > 12:
            row += "+"
        elif iteration > 5:
            row += "."
        else:
            row += " "
        x += 1
    print(row)
    y += 1
