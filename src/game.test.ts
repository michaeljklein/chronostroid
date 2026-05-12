import { describe, it, expect } from "vitest";
import {
    createGameState,
    tickLobby,
    tickPlaying,
    tickGameOver,
} from "./game";

describe("T-12 — Win condition / game state machine", () => {
    it("HP deduction to 0 → state transitions to GAME_OVER with correct winner", () => {
        const state = { ...createGameState(), name: "PLAYING" as const };
        // p1Hp = 0 → p2 wins
        const next = tickPlaying(state, 0, 5);
        expect(next.name).toBe("GAME_OVER");
        expect(next.winner).toBe(2);
    });

    it("HP deduction to 1 → state remains PLAYING", () => {
        const state = { ...createGameState(), name: "PLAYING" as const };
        const next = tickPlaying(state, 1, 5);
        expect(next.name).toBe("PLAYING");
        expect(next.winner).toBeNull();
    });

    it("SYSTEM.TWO_PLAYER press in GAME_OVER → transitions to LOBBY, ready flags reset", () => {
        const state = {
            name: "GAME_OVER" as const,
            lobby: { p1: false, p2: false },
            winner: 2 as const,
        };
        const next = tickGameOver(state, { onePlayerPressed: false, twoPlayerPressed: true });
        expect(next.name).toBe("LOBBY");
        expect(next.lobby.p1).toBe(false);
        expect(next.lobby.p2).toBe(false);
    });

    it("Lobby: P1 presses 1, then P2 presses 2 → game starts (PLAYING)", () => {
        let state = createGameState();
        // P1 presses ONE_PLAYER
        state = tickLobby(state, { onePlayerPressed: true, twoPlayerPressed: false });
        expect(state.name).toBe("LOBBY");
        expect(state.lobby.p1).toBe(true);
        // P2 presses TWO_PLAYER
        state = tickLobby(state, { onePlayerPressed: false, twoPlayerPressed: true });
        expect(state.name).toBe("PLAYING");
    });

    // T-12 follow-on: simultaneous P1/P2 HP = 0 — p1 check fires first so P2 wins
    it("simultaneous P1 and P2 HP=0: P2 wins (p1Hp checked first in tickPlaying)", () => {
        const state = { ...createGameState(), name: "PLAYING" as const };
        const next = tickPlaying(state, 0, 0);
        expect(next.name).toBe("GAME_OVER");
        expect(next.winner).toBe(2);
    });

    // T-12 follow-on: winner cleared when transitioning back to LOBBY via TWO_PLAYER
    it("winner is cleared (null) when transitioning back to LOBBY via TWO_PLAYER from GAME_OVER", () => {
        const state = {
            name: "GAME_OVER" as const,
            lobby: { p1: false, p2: false },
            winner: 1 as const,
        };
        const next = tickGameOver(state, { onePlayerPressed: false, twoPlayerPressed: true });
        expect(next.name).toBe("LOBBY");
        expect(next.winner).toBeNull();
    });

    it("Lobby: P2 presses 2 alone → game does not start, P1 not ready", () => {
        const state = createGameState();
        const next = tickLobby(state, { onePlayerPressed: false, twoPlayerPressed: true });
        expect(next.name).toBe("LOBBY");
        expect(next.lobby.p2).toBe(true);
        expect(next.lobby.p1).toBe(false);
    });
});
