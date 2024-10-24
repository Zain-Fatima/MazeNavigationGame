import * as THREE from "three";

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Maze dimensions
const mazeWidth = 15;
const mazeHeight = 10;
const wallHeight = 5;
const wallThickness = 1;
const cellSize = 6;

// Updated color scheme for the walls
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x0077ff });
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x4CAF50 });

// Sphere setup (player)
const sphereRadius = 1.2; 
const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 16, 16);
const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
const player = new THREE.Mesh(sphereGeometry, sphereMaterial);

// Set player position to a valid starting position (centered on an open wall)
const startRow = 9;
const startCol = 7;
const playerStartX = startCol * cellSize + cellSize / 6;
const playerStartZ = startRow * cellSize + cellSize / 2;
player.position.set(playerStartX, sphereRadius, playerStartZ);
scene.add(player);

// Position camera to look at the maze
camera.position.set(mazeWidth * cellSize / 2, 50, mazeHeight * cellSize + 10);
camera.lookAt(mazeWidth * cellSize / 2, 0, mazeHeight * cellSize / 2);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
scene.add(directionalLight);

// Array to store all walls for collision detection
const collisions = [];

// Function to create maze walls and floors
function renderMaze(maze) {
    for (let row = 0; row < mazeHeight; row++) {
        for (let col = 0; col < mazeWidth; col++) {
            const cell = maze[row][col];
            const x = col * cellSize;
            const z = row * cellSize;

            // Floor for each cell
            const floorGeometry = new THREE.BoxGeometry(cellSize, 0.1, cellSize);
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.position.set(x, 0, z);
            scene.add(floor);

            // Top wall
            if (cell.walls[0] && !(row === 0 && col === Math.floor(mazeWidth / 2))) // Open top wall for entry
                createWall(x, z - cellSize / 2, cellSize, wallThickness);
            // Right wall
            if (cell.walls[1]) createWall(x + cellSize / 2, z, wallThickness, cellSize);
            // Bottom wall
            if (cell.walls[2] && !(row === mazeHeight - 1 && col === Math.floor(mazeWidth / 2))) // Open bottom wall for exit
                createWall(x, z + cellSize / 2, cellSize, wallThickness);
            // Left wall
            if (cell.walls[3]) createWall(x - cellSize / 2, z, wallThickness, cellSize);
        }
    }
}

// Function to create walls
function createWall(x, z, width, depth) {
    const geometry = new THREE.BoxGeometry(width, wallHeight, depth);
    const wall = new THREE.Mesh(geometry, wallMaterial);
    wall.position.set(x, wallHeight / 2, z);
    scene.add(wall);

    // Add collision box for the wall
    const wallBBox = new THREE.Box3().setFromObject(wall);
    collisions.push(wallBBox);
}

// Maze generation using Recursive Backtracking
function generateMaze(width, height) {
    const maze = Array.from({ length: height }, () =>
        Array.from({ length: width }, () => ({
            walls: [true, true, true, true],
            visited: false
        }))
    );

    const stack = [];
    const startRow = Math.floor(Math.random() * height);
    const startCol = Math.floor(Math.random() * width);
    const startCell = maze[startRow][startCol];

    startCell.visited = true;
    stack.push([startRow, startCol]);

    const directions = [
        [-1, 0, 0],
        [0, 1, 1],
        [1, 0, 2],
        [0, -1, 3]
    ];

    while (stack.length > 0) {
        const [currentRow, currentCol] = stack.pop();
        const currentCell = maze[currentRow][currentCol];

        const unvisitedNeighbors = [];

        for (const [dy, dx, dirIndex] of directions) {
            const neighborRow = currentRow + dy;
            const neighborCol = currentCol + dx;

            if (neighborRow >= 0 && neighborRow < height && neighborCol >= 0 && neighborCol < width) {
                const neighborCell = maze[neighborRow][neighborCol];
                if (!neighborCell.visited) {
                    unvisitedNeighbors.push([neighborRow, neighborCol, dirIndex]);
                }
            }
        }

        if (unvisitedNeighbors.length > 0) {
            stack.push([currentRow, currentCol]);
            const [nextRow, nextCol, dirIndex] = unvisitedNeighbors[Math.floor(Math.random() * unvisitedNeighbors.length)];
            const nextCell = maze[nextRow][nextCol];

            currentCell.walls[dirIndex] = false;
            nextCell.walls[(dirIndex + 2) % 4] = false;

            nextCell.visited = true;
            stack.push([nextRow, nextCol]);
        }
    }

    return maze;
}

// Render the generated maze
const maze = generateMaze(mazeWidth, mazeHeight);
renderMaze(maze);

// Handle keyboard controls
const keys = {};
document.addEventListener('keydown', (event) => {
    keys[event.code] = true;
});
document.addEventListener('keyup', (event) => {
    keys[event.code] = false;
});

// Collision detection function
function detectCollisions(newPosX, newPosZ) {
    const playerBBox = new THREE.Box3().setFromObject(player);
    playerBBox.translate(new THREE.Vector3(newPosX - player.position.x, 0, newPosZ - player.position.z));

    for (const wallBBox of collisions) {
        if (playerBBox.intersectsBox(wallBBox)) {
            return true; // Collision detected
        }
    }

    return false; // No collision
}

// Game over logic
let gameOver = false;
const gameOverScreen = document.getElementById("gameOver");
const restartBtn = document.getElementById("restartBtn");

function checkGameOver() {
    // Check if the player crosses the open wall at the exit
    // Open bottom wall for exit
    const exitRow = 0; // Exit row
    const exitCol = Math.floor(mazeWidth / 2); // Exit column

    // Check if the player is beyond the bottom row and within the exit column
    if (player.position.z < (exitRow * cellSize - cellSize / 2) &&
        player.position.x > (exitCol * cellSize - cellSize / 2) &&
        player.position.x < (exitCol * cellSize + cellSize / 2)) {
        gameOver = true;
        gameOverScreen.style.display = "block"; // Show game over screen
    }
}

// Updated movement logic with proper collision detection
const speed = 0.2;
function movePlayer() {
    if (gameOver) return; // Stop moving if game is over

    let moveX = 0;
    let moveZ = 0;

    // Arrow keys for movement
    if (keys['ArrowUp']) moveZ -= speed;
    if (keys['ArrowDown']) moveZ += speed;
    if (keys['ArrowLeft']) moveX -= speed;
    if (keys['ArrowRight']) moveX += speed;

    // Compute new position
    const newPosX = player.position.x + moveX;
    const newPosZ = player.position.z + moveZ;

    // Check for collisions before updating player position
    if (!detectCollisions(newPosX, newPosZ)) {
        player.position.x = newPosX;
        player.position.z = newPosZ;
    }

    checkGameOver(); // Check for game over condition
}

// Restart the game
restartBtn.addEventListener('click', () => {
    location.reload(); // Reload the page to restart the game
});

// Animation loop
function animate() {
    movePlayer();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
animate();
