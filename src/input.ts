import { PLAYER_1, PLAYER_2, SYSTEM } from "@rcade/plugin-input-classic";
import {
    PLAYER_1 as PLAYER_1_SPIN,
    PLAYER_2 as PLAYER_2_SPIN,
} from "@rcade/plugin-input-spinners";
import type { GameState } from "./game";

export type PlayerInput = {
    rotateLeft: boolean;   // dpad.left
    rotateRight: boolean;  // dpad.right
    thrust: boolean;       // A
    fire: boolean;         // B (level-triggered; bullet module handles cooldown)
    spinnerDelta: number;  // accumulated since last frame
};

export type SystemInput = {
    onePlayerPressed: boolean;  // edge-detected
    twoPlayerPressed: boolean;  // edge-detected
};

export type FrameInput = {
    p1: PlayerInput;
    p2: PlayerInput;
    system: SystemInput;
};

export type InputState = {
    prevOnePlayer: boolean;
    prevTwoPlayer: boolean;
};

export function createInputState(): InputState {
    return { prevOnePlayer: false, prevTwoPlayer: false };
}

export function readFrame(state: InputState): { input: FrameInput; state: InputState } {
    const onePlayerNow = SYSTEM.ONE_PLAYER;
    const twoPlayerNow = SYSTEM.TWO_PLAYER;

    const input: FrameInput = {
        p1: {
            rotateLeft: PLAYER_1.DPAD.left,
            rotateRight: PLAYER_1.DPAD.right,
            thrust: PLAYER_1.A,
            fire: PLAYER_1.B,
            spinnerDelta: PLAYER_1_SPIN.SPINNER.consume_step_delta(),
        },
        p2: {
            rotateLeft: PLAYER_2.DPAD.left,
            rotateRight: PLAYER_2.DPAD.right,
            thrust: PLAYER_2.A,
            fire: PLAYER_2.B,
            spinnerDelta: PLAYER_2_SPIN.SPINNER.consume_step_delta(),
        },
        system: {
            onePlayerPressed: onePlayerNow && !state.prevOnePlayer,
            twoPlayerPressed: twoPlayerNow && !state.prevTwoPlayer,
        },
    };

    return {
        input,
        state: { prevOnePlayer: onePlayerNow, prevTwoPlayer: twoPlayerNow },
    };
}

/**
 * Returns per-player inputs only when the game is in PLAYING state.
 * During LOBBY or GAME_OVER, both players' inputs are null (callers should
 * not apply ship physics/bullets when not in an active game).
 */
export function selectPlayerInput(
    gameState: GameState,
    frameInput: FrameInput,
): { p1: PlayerInput | null; p2: PlayerInput | null } {
    if (gameState.name !== "PLAYING") {
        return { p1: null, p2: null };
    }
    return { p1: frameInput.p1, p2: frameInput.p2 };
}

/**
 * Returns the system input only when the game is NOT in PLAYING state.
 * During PLAYING, system buttons (ONE_PLAYER / TWO_PLAYER) are ignored.
 */
export function selectSystemInput(
    gameState: GameState,
    frameInput: FrameInput,
): SystemInput | null {
    if (gameState.name === "PLAYING") {
        return null;
    }
    return frameInput.system;
}
