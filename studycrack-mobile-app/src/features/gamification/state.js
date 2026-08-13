import { createFeatureSlice } from '../../state/create-feature-slice.js';

export function createGamificationInitialState() {
  return {
    serverResource: {
      activeFish: [],
      fishCatalog: [],
      fishCatalogError: '',
      fishCatalogStatus: 'idle',
      fishInventory: [],
      fishCount: 0,
      gameProfile: null,
      gameProfileStatus: 'idle',
      gameProfileError: '',
      gameRules: null,
      habitatDays: [],
      habitatStatus: 'idle',
      habitatError: '',
      pendingDraw: null,
      pendingDrawStatus: 'idle',
      pendingDrawError: '',
      gameRefreshTick: 0
    },
    localDraft: {
      activeDrawRequestId: ''
    },
    ephemeralUi: {
      aquariumActionError: '',
      aquariumActionStatus: 'idle',
      aquariumDrawRevealStep: 0,
      aquariumMode: 'view',
      aquariumResult: null,
      aquariumSelectedFishId: '',
      aquariumStarterSpeciesId: '',
      gameRulesOpen: false,
      gameError: ''
    }
  };
}

export const gamificationSlice = createFeatureSlice('gamification', createGamificationInitialState);
