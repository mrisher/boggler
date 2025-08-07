import { bonusReducer, initialState } from './bonusReducer';

describe('bonusReducer', () => {
  it('should return the initial state', () => {
    expect(bonusReducer(initialState, {})).toEqual(initialState);
  });

  describe('START_GAME', () => {
    it('should set the start times for the bonuses', () => {
      const action = {
        type: 'START_GAME',
        payload: {
          seed: 1234,
          isDebug: false,
        },
      };
      const state = bonusReducer(initialState, action);
      expect(state.tripleWordStartTime).toBeGreaterThan(0);
      expect(state.silverTileStartTime).toBeGreaterThan(0);
      expect(state.harlequin.startTime).toBeGreaterThan(0);
    });

    it('should set the start times for the bonuses in debug mode', () => {
      const action = {
        type: 'START_GAME',
        payload: {
          seed: 'debug',
          isDebug: true,
        },
      };
      const state = bonusReducer(initialState, action);
      expect(state.harlequin.startTime).toBe(1);
      expect(state.silverTileStartTime).toBe(17);
      expect(state.tripleWordStartTime).toBe(33);
    });
  });

  describe('TICK', () => {
    it('should activate harlequin bonus at the correct time', () => {
      const startGameAction = {
        type: 'START_GAME',
        payload: { seed: 'debug', isDebug: true },
      };
      let state = bonusReducer(initialState, startGameAction);

      const tickAction = {
        type: 'TICK',
        payload: {
          allPossibleWords: new Map([['LONGEST', [0, 1, 2, 3, 4, 5, 6]]]),
          foundWords: [],
          seed: 'debug',
          timeLeft: 119, // getTime() - 1, so now is 1
          isDebug: true,
        },
      };

      state = bonusReducer(state, tickAction);

      expect(state.harlequin.isActive).toBe(true);
      expect(state.harlequin.word).toBe('LONGEST');
      expect(state.harlequin.timer).toBe(15);
    });
  it('should activate silver tile bonus at the correct time', () => {
      const startGameAction = {
        type: 'START_GAME',
        payload: { seed: 'debug', isDebug: true },
      };
      let state = bonusReducer(initialState, startGameAction);

      const tickAction = {
        type: 'TICK',
        payload: {
          allPossibleWords: new Map([['WORD', [0, 1, 2, 3]]]),
          foundWords: [],
          seed: 'debug',
          timeLeft: 103, // getTime() - 17, so now is 17
          isDebug: true,
        },
      };

      state = bonusReducer(state, tickAction);

      expect(state.bonusTiles.some(t => t.type === 'ST')).toBe(true);
      const silverTile = state.bonusTiles.find(t => t.type === 'ST');
      expect(silverTile.timer).toBe(15);
    });
  it('should activate triple word bonus at the correct time', () => {
      const startGameAction = {
        type: 'START_GAME',
        payload: { seed: 'debug', isDebug: true },
      };
      let state = bonusReducer(initialState, startGameAction);

      const tickAction = {
        type: 'TICK',
        payload: {
          allPossibleWords: new Map([['WORD', [0, 1, 2, 3]]]),
          foundWords: [],
          seed: 'debug',
          timeLeft: 87, // getTime() - 33, so now is 33
          isDebug: true,
        },
      };

      state = bonusReducer(state, tickAction);

      expect(state.bonusTiles.some(t => t.type === 'TW')).toBe(true);
      const tripleTile = state.bonusTiles.find(t => t.type === 'TW');
      expect(tripleTile.timer).toBe(15);
    });
  it('should countdown timers for active bonuses', () => {
      const stateWithActiveBonuses = {
        ...initialState,
        bonusTiles: [
          { index: 0, type: 'TW', timer: 10 },
          { index: 1, type: 'ST', used: false, timer: 5 },
        ],
        harlequin: { ...initialState.harlequin, isActive: true, timer: 12 },
      };

      const tickAction = {
        type: 'TICK',
        payload: {
          allPossibleWords: new Map(),
          foundWords: [],
          seed: 'debug',
          timeLeft: 50,
          isDebug: false,
        },
      };

      const state = bonusReducer(stateWithActiveBonuses, tickAction);

      expect(state.bonusTiles.find(t => t.type === 'TW').timer).toBe(9);
      expect(state.bonusTiles.find(t => t.type === 'ST').timer).toBe(4);
      expect(state.harlequin.timer).toBe(11);
    });
  it('should not activate a new bonus if one is already active', () => {
      const startGameAction = {
        type: 'START_GAME',
        payload: { seed: 'debug', isDebug: true },
      };
      let state = bonusReducer(initialState, startGameAction);

      // Manually activate harlequin
      state.harlequin.isActive = true;
      state.harlequin.timer = 10;

      const tickAction = {
        type: 'TICK',
        payload: {
          allPossibleWords: new Map([['WORD', [0, 1, 2, 3]]]),
          foundWords: [],
          seed: 'debug',
          timeLeft: 103, // Silver tile would normally activate here
          isDebug: true,
        },
      };

      const nextState = bonusReducer(state, tickAction);

      expect(nextState.bonusTiles.some(t => t.type === 'ST')).toBe(false);
    });
  });
});
