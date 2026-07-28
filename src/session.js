import { updateMarkerLayout } from "./layout.js";

const cloneSnapshot = (state) => {
  if (!state) return null;
  return {
    version: 1,
    epoch: state.epoch,
    visible: state.visible.map((entry) => ({
      id: entry.id,
      variantKey: entry.variantKey,
    })),
  };
};

export const createMarkerLayout = (options = {}) => {
  let state = null;

  return {
    update(frame) {
      const result = updateMarkerLayout(state, frame, options);
      state = cloneSnapshot(result.state);
      return result;
    },

    reset() {
      state = null;
    },

    snapshot() {
      return cloneSnapshot(state);
    },
  };
};
