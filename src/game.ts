import type p5 from "p5";
import CONSTANTS from "./constants.json";

export type GameStateName = "LOBBY" | "PLAYING" | "GAME_OVER";

export type LobbyReady = { p1: boolean; p2: boolean };

export type GameState = {
    name: GameStateName;
    lobby: LobbyReady;
    winner: 1 | 2 | null;
};

export type SystemInput = {
    /** Edge-detected `SYSTEM.ONE_PLAYER` (true only on the rising edge frame). */
    onePlayerPressed: boolean;
    /** Edge-detected `SYSTEM.TWO_PLAYER`. */
    twoPlayerPressed: boolean;
};

export function createGameState(): GameState {
    return {
        name: "LOBBY",
        lobby: { p1: false, p2: false },
        winner: null,
    };
}

/**
 * Lobby tick: handles ready signals, returns updated state.
 * Transitions to PLAYING when both ready.
 */
export function tickLobby(state: GameState, input: SystemInput): GameState {
    const p1 = input.onePlayerPressed ? true : state.lobby.p1;
    const p2 = input.twoPlayerPressed ? true : state.lobby.p2;

    if (p1 && p2) {
        return {
            name: "PLAYING",
            lobby: { p1: false, p2: false },
            winner: null,
        };
    }

    return {
        ...state,
        lobby: { p1, p2 },
    };
}

/**
 * Playing tick: caller has already resolved damage; pass current HP values.
 * If either HP <= 0, transitions to GAME_OVER with winner = the player whose HP > 0.
 * SystemInput intentionally not a parameter (ignored per spec).
 */
export function tickPlaying(state: GameState, p1Hp: number, p2Hp: number): GameState {
    if (p1Hp <= 0) {
        return { ...state, name: "GAME_OVER", winner: 2 };
    }
    if (p2Hp <= 0) {
        return { ...state, name: "GAME_OVER", winner: 1 };
    }
    return state;
}

/**
 * Game-over tick: TWO_PLAYER press returns to LOBBY (with reset ready flags).
 * ONE_PLAYER ignored.
 */
export function tickGameOver(state: GameState, input: SystemInput): GameState {
    if (input.twoPlayerPressed) {
        return {
            name: "LOBBY",
            lobby: { p1: false, p2: false },
            winner: null,
        };
    }
    return state;
}

/** Draws the lobby screen (title + per-player ready prompts) using p5. */
export function drawLobby(p: p5, state: GameState): void {
    const cx = CONSTANTS.CANVAS.WIDTH / 2;
    const cy = CONSTANTS.CANVAS.HEIGHT / 2;
    p.fill(255);
    p.noStroke();
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(CONSTANTS.CANVAS.TITLE_FONT_SIZE);
    p.text("CHRONOSTROID", cx, cy - 24);
    p.textSize(CONSTANTS.CANVAS.HUD_FONT_SIZE);
    const p1Text = state.lobby.p1 ? "P1: ✓" : "P1: press 1";
    const p2Text = state.lobby.p2 ? "P2: ✓" : "P2: press 2";
    p.text(`${p1Text}   ${p2Text}`, cx, cy + 8);
}

/** Draws the game-over overlay on top of the (frozen) field. */
export function drawGameOver(p: p5, winner: 1 | 2): void {
    p.fill(255);
    p.noStroke();
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(CONSTANTS.CANVAS.TITLE_FONT_SIZE);
    p.text(`P${winner} WINS`, CONSTANTS.CANVAS.WIDTH / 2, CONSTANTS.CANVAS.HEIGHT / 2);
}
