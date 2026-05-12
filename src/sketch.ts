import p5 from "p5";
import { PLAYER_1, PLAYER_2, SYSTEM } from "@rcade/plugin-input-classic";
import {
    PLAYER_1 as PLAYER_1_SPIN,
    PLAYER_2 as PLAYER_2_SPIN,
} from "@rcade/plugin-input-spinners";
import CONSTANTS from "./constants.json";

export type GameState = "LOBBY" | "PLAYING" | "GAME_OVER";

const sketch = (p: p5) => {
    let state: GameState = "LOBBY";
    let p1Ready = false;
    let p2Ready = false;
    let prevOnePlayer = false;
    let prevTwoPlayer = false;

    p.setup = () => {
        p.createCanvas(CONSTANTS.CANVAS.WIDTH, CONSTANTS.CANVAS.HEIGHT);
        p.frameRate(60);
        p.textFont("monospace");
        p.noSmooth();
        void PLAYER_1; void PLAYER_2; void PLAYER_1_SPIN; void PLAYER_2_SPIN;
    };

    p.draw = () => {
        p.background(0);

        if (state === "LOBBY") {
            const onePressed = SYSTEM.ONE_PLAYER && !prevOnePlayer;
            const twoPressed = SYSTEM.TWO_PLAYER && !prevTwoPlayer;
            if (onePressed) p1Ready = true;
            if (twoPressed) p2Ready = true;
            drawLobby(p, p1Ready, p2Ready);
            if (p1Ready && p2Ready) {
                state = "PLAYING";
                p1Ready = false;
                p2Ready = false;
            }
        } else if (state === "PLAYING") {
            // Wave-2+ modules plug in here.
            drawPlayingPlaceholder(p);
        } else {
            drawGameOver(p);
            const twoPressed = SYSTEM.TWO_PLAYER && !prevTwoPlayer;
            if (twoPressed) {
                state = "LOBBY";
                p1Ready = false;
                p2Ready = false;
            }
        }

        prevOnePlayer = SYSTEM.ONE_PLAYER;
        prevTwoPlayer = SYSTEM.TWO_PLAYER;
    };
};

function drawLobby(p: p5, p1Ready: boolean, p2Ready: boolean) {
    const cx = CONSTANTS.CANVAS.WIDTH / 2;
    const cy = CONSTANTS.CANVAS.HEIGHT / 2;
    p.fill(255);
    p.noStroke();
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(CONSTANTS.CANVAS.TITLE_FONT_SIZE);
    p.text("CHRONOSTROID", cx, cy - 24);
    p.textSize(CONSTANTS.CANVAS.HUD_FONT_SIZE);
    const p1Text = p1Ready ? "P1: ✓" : "P1: press 1";
    const p2Text = p2Ready ? "P2: ✓" : "P2: press 2";
    p.text(`${p1Text}   ${p2Text}`, cx, cy + 8);
}

function drawPlayingPlaceholder(p: p5) {
    p.fill(80);
    p.noStroke();
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(CONSTANTS.CANVAS.HUD_FONT_SIZE);
    p.text("(game)", CONSTANTS.CANVAS.WIDTH / 2, CONSTANTS.CANVAS.HEIGHT / 2);
}

function drawGameOver(p: p5) {
    p.fill(255);
    p.noStroke();
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(CONSTANTS.CANVAS.TITLE_FONT_SIZE);
    p.text("GAME OVER", CONSTANTS.CANVAS.WIDTH / 2, CONSTANTS.CANVAS.HEIGHT / 2);
}

new p5(sketch, document.getElementById("sketch")!);
