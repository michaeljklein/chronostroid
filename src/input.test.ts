import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock state — available inside vi.mock factory closures
// ---------------------------------------------------------------------------

const { mockPlayer1, mockPlayer2, mockSystem, mockSpinState } = vi.hoisted(() => {
    const mockPlayer1 = {
        DPAD: { left: false, right: false, up: false, down: false },
        A: false,
        B: false,
    };
    const mockPlayer2 = {
        DPAD: { left: false, right: false, up: false, down: false },
        A: false,
        B: false,
    };
    const mockSystem = { ONE_PLAYER: false, TWO_PLAYER: false };
    const mockSpinState = { spin1: 0, spin2: 0 };
    return { mockPlayer1, mockPlayer2, mockSystem, mockSpinState };
});

vi.mock("@rcade/plugin-input-classic", () => ({
    PLAYER_1: mockPlayer1,
    PLAYER_2: mockPlayer2,
    SYSTEM: mockSystem,
}));

vi.mock("@rcade/plugin-input-spinners", () => ({
    PLAYER_1: {
        SPINNER: {
            consume_step_delta: () => {
                const d = mockSpinState.spin1;
                mockSpinState.spin1 = 0;
                return d;
            },
        },
    },
    PLAYER_2: {
        SPINNER: {
            consume_step_delta: () => {
                const d = mockSpinState.spin2;
                mockSpinState.spin2 = 0;
                return d;
            },
        },
    },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
    createInputState,
    readFrame,
    selectPlayerInput,
    selectSystemInput,
} from "./input";
import { createGameState } from "./game";
import type { GameState } from "./game";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMocks() {
    mockPlayer1.DPAD.left = false;
    mockPlayer1.DPAD.right = false;
    mockPlayer1.DPAD.up = false;
    mockPlayer1.DPAD.down = false;
    mockPlayer1.A = false;
    mockPlayer1.B = false;

    mockPlayer2.DPAD.left = false;
    mockPlayer2.DPAD.right = false;
    mockPlayer2.DPAD.up = false;
    mockPlayer2.DPAD.down = false;
    mockPlayer2.A = false;
    mockPlayer2.B = false;

    mockSystem.ONE_PLAYER = false;
    mockSystem.TWO_PLAYER = false;

    mockSpinState.spin1 = 0;
    mockSpinState.spin2 = 0;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("input — edge-detection", () => {
    beforeEach(resetMocks);

    it("single fire: ONE_PLAYER held 5 consecutive frames → exactly 1 true", () => {
        let inputState = createInputState();
        mockSystem.ONE_PLAYER = true;

        const results: boolean[] = [];
        for (let i = 0; i < 5; i++) {
            const { input, state } = readFrame(inputState);
            results.push(input.system.onePlayerPressed);
            inputState = state;
        }

        expect(results.filter(Boolean)).toHaveLength(1);
        expect(results[0]).toBe(true);
        expect(results.slice(1).every((v) => v === false)).toBe(true);
    });

    it("re-press: release then press again → second press fires", () => {
        let inputState = createInputState();

        // Frame 1: press
        mockSystem.ONE_PLAYER = true;
        const { input: f1, state: s1 } = readFrame(inputState);
        expect(f1.system.onePlayerPressed).toBe(true);
        inputState = s1;

        // Frame 2: held (no edge)
        const { input: f2, state: s2 } = readFrame(inputState);
        expect(f2.system.onePlayerPressed).toBe(false);
        inputState = s2;

        // Frame 3: release
        mockSystem.ONE_PLAYER = false;
        const { input: f3, state: s3 } = readFrame(inputState);
        expect(f3.system.onePlayerPressed).toBe(false);
        inputState = s3;

        // Frame 4: press again → rising edge fires
        mockSystem.ONE_PLAYER = true;
        const { input: f4 } = readFrame(inputState);
        expect(f4.system.onePlayerPressed).toBe(true);
    });
});

describe("input — state gating (selectPlayerInput)", () => {
    beforeEach(resetMocks);

    it("P1 thrust ignored in LOBBY: selectPlayerInput returns null for both players", () => {
        const gameState: GameState = createGameState(); // name === "LOBBY"
        mockPlayer1.A = true;

        const inputState = createInputState();
        const { input } = readFrame(inputState);

        // Raw input has thrust=true
        expect(input.p1.thrust).toBe(true);

        // But the gating helper returns null during LOBBY
        const { p1, p2 } = selectPlayerInput(gameState, input);
        expect(p1).toBeNull();
        expect(p2).toBeNull();
    });

    it("selectPlayerInput returns actual inputs during PLAYING", () => {
        const gameState: GameState = { name: "PLAYING", lobby: { p1: false, p2: false }, winner: null };
        mockPlayer1.A = true;

        const inputState = createInputState();
        const { input } = readFrame(inputState);

        const { p1, p2 } = selectPlayerInput(gameState, input);
        expect(p1).not.toBeNull();
        expect(p1!.thrust).toBe(true);
        expect(p2).not.toBeNull();
    });
});

describe("input — state gating (selectSystemInput)", () => {
    beforeEach(resetMocks);

    it("ONE_PLAYER ignored in PLAYING: selectSystemInput returns null", () => {
        const gameState: GameState = { name: "PLAYING", lobby: { p1: false, p2: false }, winner: null };
        mockSystem.ONE_PLAYER = true;

        const inputState = createInputState();
        const { input } = readFrame(inputState);

        // Edge fires (first press)
        expect(input.system.onePlayerPressed).toBe(true);

        // But gating suppresses it during PLAYING
        const sys = selectSystemInput(gameState, input);
        expect(sys).toBeNull();
    });

    it("TWO_PLAYER ignored in PLAYING: selectSystemInput returns null", () => {
        const gameState: GameState = { name: "PLAYING", lobby: { p1: false, p2: false }, winner: null };
        mockSystem.TWO_PLAYER = true;

        const inputState = createInputState();
        const { input } = readFrame(inputState);

        expect(input.system.twoPlayerPressed).toBe(true);

        const sys = selectSystemInput(gameState, input);
        expect(sys).toBeNull();
    });

    it("selectSystemInput returns system input in LOBBY and GAME_OVER", () => {
        const lobby: GameState = createGameState(); // "LOBBY"
        mockSystem.ONE_PLAYER = true;
        const inputState = createInputState();
        const { input: lobbyInput } = readFrame(inputState);
        expect(selectSystemInput(lobby, lobbyInput)).not.toBeNull();
        expect(selectSystemInput(lobby, lobbyInput)!.onePlayerPressed).toBe(true);

        const gameOver: GameState = { name: "GAME_OVER", lobby: { p1: false, p2: false }, winner: 1 };
        expect(selectSystemInput(gameOver, lobbyInput)).not.toBeNull();
    });
});
