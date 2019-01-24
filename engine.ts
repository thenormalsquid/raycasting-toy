const CIRCLE = Math.PI * 2;
const NDOGS = 16;

function generateDogImages(): Bitmap[] {
   const doggs = [];
   for (let i = 1; i <= NDOGS; i++) {
    doggs.push(new Bitmap(`dog${i}.jpg`, 1024, 1024));
   }
   return doggs;
}

// based david walsh
function debounce(func, wait, immediate?) {
	var timeout;
	return function() {
		var context = this, args = arguments;
		var later = function() {
			timeout = null;
			if (!immediate) func.apply(context, args);
		};
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) func.apply(context, args);
	};
};

enum ControllerDirection {
    LEFT = 65,
    BACKWARD = 83,
    FORWARD = 87,
    RIGHT = 68
}

interface ControllerState extends Map<ControllerDirection, boolean> { }

interface ControllerInterface { 
    states: ControllerState;
}

interface Coordinate {
    x: number;
    y: number;
    length2?: number;
}

interface Step extends Coordinate {
    height?: number;
    distance?: number;
    offset?: number;
    shading?: number;
}

interface Entity {
    coordinate: Coordinate;
    direction: number;
}

interface MapInterface { 
    getCell(row: number, col: number): number;
}


class WorldMap implements MapInterface {
    grid: number[][];
    size: number;
    skybox;
    light;
    dogs;
    constructor(size: number) {
        this.size = size;
        this.grid = this.__initializeGrid(size);
        this.skybox = new Bitmap('bg.png', 1200, 750);
        this.light = 0;
        this.dogs = generateDogImages();
    }

    wallTexture = (): Bitmap => {
        return this.dogs[Math.floor(Math.random() * this.dogs.length)];
    }

    __initializeGrid = (size: number) => {
        const grid = [];
        // square for simplicity sake
        for(let row = 0; row < size; row++) {
           const rows = [];
           grid.push(rows);
           for(let col = 0; col < size; col++) {
             grid[row][col] = Math.random() < 0.3 ? 1 : 0;  //randomly place a wall
           } 
        }
        return grid;
    }

    __outOfBounds = (num: number): boolean => (num < 0 || num > this.size - 1)

    // meat and bones
    __inspect = (sin: number, cos: number, step: Step, shiftX, shiftY, distance, offset): Step => {
        const dx = cos < 0 ? shiftX : 0;
        const dy = sin < 0 ? shiftY : 0;
        // calculate the height of the wall
        step.height = this.getCell(step.x - dx, step.y - dy);
        step.distance = distance + Math.sqrt(step.length2);
        if (shiftX) step.shading = cos < 0 ? 2 : 0;
        else step.shading = sin < 0 ? 2 : 1;
        step.offset = offset - Math.floor(offset);
        return step;
    }

    __step = (rise, run, x, y, inverted?: boolean): Coordinate | Step => {
        if (run === 0) return { x: 0, y: 0 };
        const dx = run > 0 ? Math.floor(x + 1) - x : Math.ceil(x - 1) - x;
        const dy = dx * (rise / run);
    
        return {
          x: inverted ? y + dy : x + dx,
          y: inverted ? x + dx : y + dy,
          length2: dx * dx + dy * dy
        };
    }
    
    ray = (origin: Step, sin: number, cos: number, range: number) => {
        const stepX = this.__step(sin, cos, origin.x, origin.y);
        const stepY = this.__step(cos, sin, origin.y, origin.x, true);
        const nextStep = stepX.length2 < stepY.length2
          ? this.__inspect(sin, cos, stepX, 1, 0, origin.distance, stepX.y)
          : this.__inspect(sin, cos, stepY, 0, 1, origin.distance, stepY.x);
        if (nextStep.distance > range) return [origin];
        return [origin].concat(this.ray(nextStep, sin, cos, range));
    }

    cast = (point: Coordinate, angle: number, range: number) => {
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        return this.ray({ ...point, height: 0, distance: 0 }, sin, cos, range);
    }


    getCell = (row: number, col: number) => {
        const normalizedRow = Math.floor(row);
        const normalizedCol = Math.floor(col);
        // check ur bounds
        if (this.__outOfBounds(normalizedCol)) return -1;
        if (this.__outOfBounds(normalizedRow)) return -1;

        return this.grid[normalizedRow][normalizedCol];
    }
}

class Control implements ControllerInterface {
    states: ControllerState;
    constructor() {
        // init movement state
        this.states = this.resetState();

        document.addEventListener('keydown', this.onKey.bind(this, true), false);
        document.addEventListener('keyup', this.onKey.bind(this, false), false);
        document.addEventListener('touchstart', this.onTouch, false);
        document.addEventListener('touchmove', this.onTouch, false);
        document.addEventListener('touchend', this.onTouchEnd, false);
    }

    resetState = (): ControllerState => new Map<ControllerDirection, boolean>([
        [ControllerDirection.BACKWARD, false],
        [ControllerDirection.FORWARD, false],
        [ControllerDirection.LEFT, false],
        [ControllerDirection.RIGHT, false]
    ])

    onTouch = (e: TouchEvent) => {
        const t = e.touches[0];
        this.onTouchEnd(e);
        if (t.pageY < window.innerHeight * 0.5) this.onKey(true, { keyCode: ControllerDirection.FORWARD });
        else if (t.pageX < window.innerWidth * 0.5) this.onKey(true, { keyCode: ControllerDirection.LEFT });
        else if (t.pageY > window.innerWidth * 0.5) this.onKey(true, { keyCode: ControllerDirection.RIGHT });
        e.preventDefault && e.preventDefault();
        e.stopPropagation && e.stopPropagation();
    }

    onKey = (moving: boolean, e: { keyCode?: ControllerDirection }) => {
        console.log(e);
        if (!e.keyCode ) return;
        this.states.set(e.keyCode, moving);
    }

    onTouchEnd = (e: TouchEvent) => {
        // STOP RIGHT THERE, CRIMINAL SCUM
        this.states = this.resetState();
        e.preventDefault();
        e.stopPropagation();
      };
}

// u da real playa
class Player implements Entity {
    coordinate;
    direction: number;
    paces;
    hand;
    constructor(coord: Coordinate, direction: number) {
        this.coordinate = coord;
        this.direction = direction;
        this.paces = 0;
        this.hand = new Bitmap('hand.png', 270, 270);
    }

    rotate = (angle: number) => {
        this.direction = (this.direction + angle + CIRCLE) % CIRCLE;
    }

    walk = (distance: number, map: MapInterface) => {
        const dx = Math.cos(this.direction) * distance;
        const dy = Math.sin(this.direction) * distance;
        if (map.getCell(this.coordinate.x + dx, this.coordinate.y) <= 0) this.coordinate.x += dx;
        if (map.getCell(this.coordinate.x, this.coordinate.y + dy) <= 0) this.coordinate.y += dy;
        this.paces += distance;
    }

    update = (controls: Control, map: WorldMap, seconds: number) => {
        if (controls.states.get(ControllerDirection.LEFT)) this.rotate(-Math.PI * seconds);
        if (controls.states.get(ControllerDirection.RIGHT)) this.rotate(Math.PI * seconds);
        if (controls.states.get(ControllerDirection.FORWARD)) this.walk(3 * seconds, map);
        if (controls.states.get(ControllerDirection.BACKWARD)) this.walk(-3 * seconds, map);
      }
}

class Bitmap { 
    image: HTMLImageElement;
    width: number;
    height: number;
    constructor(src: string, width: number, height: number) {
        this.image = new Image();
        this.image.src = src;
        this.width = width;
        this.height = height;
    }
}

class Camera {
    resolution;
    focalLength;
    width;
    height;
    ctx;
    spacing;
    range;
    lightRange;
    scale;

    constructor(canvas, resolution, focalLength) {
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width = window.innerWidth * 0.5;
        this.height = canvas.height = window.innerHeight * 0.5;
        this.resolution = resolution;
        this.spacing = this.width / resolution;
        this.focalLength = focalLength || 0.8;
        this.range = 14;
        this.lightRange = 5;
        this.scale = (this.width + this.height) / 1200;
    }
    
    render = (player, map, texture) => {
        this.drawSky(player.direction, map.skybox, map.light);
        this.drawColumns(player, map, texture);
        this.drawHand(player.hand, player.paces);
    }

    drawSky = (direction, sky, ambient) => {
        const width = sky.width * (this.height / sky.height) * 2;
        const left = (direction / CIRCLE) * -width;
        this.ctx.save();
        this.ctx.drawImage(sky.image, left, 0, width, this.height);
        if (left < width - this.width) {
            this.ctx.drawImage(sky.image, left + width, 0, width, this.height);
        }
        if (ambient > 0) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.globalAlpha = ambient * 0.1;
            this.ctx.fillRect(0, this.height * 0.5, this.width, this.height * 0.5);
        }
        this.ctx.restore();
    }

    drawColumn = (column, ray, angle, map, texture) => {
        const left = Math.floor(column * this.spacing);
        const width = Math.ceil(this.spacing);
        let hit = -1;
        while (++hit < ray.length && ray[hit].height <= 0);

        for (let s = ray.length - 1; s >= 0; s--) {
            const step = ray[s];
            if (s === hit) {
                var textureX = Math.floor(texture.image.width * step.offset);
                var wall = this.project(step.height, angle, step.distance);
                this.ctx.globalAlpha = 1;
                this.ctx.drawImage(texture.image, textureX, 0, 1, texture.image.height, left, wall.top, width, wall.height);

                this.ctx.fillStyle = '#000000';
                if (Math.floor(step.distance) <= 0) this.ctx.globalAlpha = 0;
                this.ctx.globalAlpha = 10000000;
                this.ctx.beginPath();
                this.ctx.arc(4, wall.top / 2, wall.height, 0, Math.PI * 2, true);
                this.ctx.fill();
            }
            
        }
    }

    project = (height, angle, distance) => {
        const z = distance * Math.cos(angle);
        const wallHeight = this.height * height / z;
        const bottom = this.height / 2 * (1 + 1 / z);
        return {
            top: bottom - wallHeight,
            height: wallHeight
        }; 
    }

    drawColumns = (player, map, texture) => {
        this.ctx.save();
        for (let column = 0; column < this.resolution; column++) {
            const x = column / this.resolution - 0.5;
            const angle = Math.atan2(x, this.focalLength);
            const ray = map.cast(player.coordinate, player.direction + angle, this.range);
            this.drawColumn(column, ray, angle, map, texture);
        }
        this.ctx.restore();
    }

    drawHand = (hand, paces) => {
        const bobX = Math.cos(paces * 2) * this.scale * 6;
        const bobY = Math.sin(paces * 4) * this.scale * 6;
        const left = this.width * 0.66 + bobX;
        const top = this.height * 0.6 + bobY;
        this.ctx.drawImage(hand.image, left, top, hand.width * this.scale, hand.height * this.scale);
    }

}

class GameLoop {
    // Thank you: https://isaacsukin.com/news/2015/01/detailed-explanation-javascript-game-loops-and-timing
    lastTime;
    callback;
    constructor() { 
        this.lastTime = 0;
        this.callback = () => ({});
    }

    start = (callback) => {
        this.callback = callback;
        requestAnimationFrame(this.frame);
    }

    frame = (time) => {
        const seconds = (time - this.lastTime) / 1000;
        this.lastTime = time;
        if (seconds < 0.2) this.callback(seconds, Math.floor(time/1000));
        requestAnimationFrame(this.frame);
    }
 
}

const display = document.getElementById('display');
const player = new Player({ x: 15.3, y: -1.2 }, Math.PI * 0.3);
const map = new WorldMap(32);
const controls = new Control();
const camera = new Camera(display, 320, 0.8);
const loop = new GameLoop();

let texture = map.wallTexture();
loop.start((seconds, time) => {
    player.update(controls, map, seconds);
    // cycle through dogs
    if (time % 10 === 0) texture = map.wallTexture();
    camera.render(player, map, texture);
});
