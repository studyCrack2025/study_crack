import { createFeatureSlice } from '../../state/create-feature-slice.js';

export function createGamificationInitialState() {
  return {
    serverResource: {
      activeFish: [],
      fishCount: 0,
      gameProfile: null,
      gameProfileStatus: 'idle',
      gameProfileError: '',
      habitatDays: [],
      habitatStatus: 'idle',
      habitatError: '',
      gameRefreshTick: 0
    },
    localDraft: {
      activeDrawRequestId: ''
    },
    ephemeralUi: {
      gameError: ''
    }
  };
}

export const gamificationSlice = createFeatureSlice('gamification', createGamificationInitialState);

