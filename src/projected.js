import { createMarkerLayout } from "./session.js";

const resolveItemId = (adapter, descriptor, item, index) => {
  if (descriptor?.id !== undefined) {
    return descriptor.id;
  }
  if (typeof adapter.id === "function") {
    return adapter.id(item, index);
  }
  return item?.id;
};

const resolveDimensions = (adapter, item, view, projected, index) => {
  if (typeof adapter.dimensions === "function") {
    return adapter.dimensions(item, view, projected, index) ?? {};
  }
  return item ?? {};
};

export const createProjectedMarkerLayout = (adapter, layoutOptions = {}) => {
  if (!adapter || typeof adapter !== "object") {
    throw new TypeError("adapter must be an object");
  }
  if (typeof adapter.project !== "function") {
    throw new TypeError("adapter.project must be a function");
  }

  const session = createMarkerLayout(layoutOptions);

  return {
    update(input) {
      if (!input || typeof input !== "object") {
        throw new TypeError("projected layout input must be an object");
      }
      if (!Array.isArray(input.items)) {
        throw new TypeError("projected layout input.items must be an array");
      }

      const viewport =
        input.viewport ??
        (typeof adapter.viewport === "function"
          ? adapter.viewport(input.view)
          : undefined);
      const pressure =
        input.pressure ??
        (typeof adapter.pressure === "function"
          ? adapter.pressure(input.view)
          : undefined);
      const epoch =
        input.epoch ??
        (typeof adapter.epoch === "function"
          ? adapter.epoch(input.view)
          : typeof adapter.stabilityKey === "function"
            ? adapter.stabilityKey(input.view)
            : undefined);

      const markers = input.items.map((item, index) => {
        const described =
          typeof adapter.describe === "function"
            ? adapter.describe(item, input.view, index)
            : null;
        const id = resolveItemId(adapter, described, item, index);
        const projected = adapter.project(item, input.view, index);
        if (
          projected &&
          projected.visible !== false &&
          (!Number.isFinite(projected.x) || !Number.isFinite(projected.y))
        ) {
          throw new TypeError(
            `adapter.project returned non-finite coordinates for item ${index}`,
          );
        }
        const projectable =
          projected &&
          projected.visible !== false &&
          Number.isFinite(projected.x) &&
          Number.isFinite(projected.y);
        const dimensions =
          described ??
          (projectable
            ? resolveDimensions(
                adapter,
                item,
                input.view,
                projected,
                index,
              )
            : {});
        const priority =
          typeof adapter.priority === "function"
            ? adapter.priority(item, input.view, projected, index)
            : dimensions.priority ?? item?.priority;
        const pinned =
          typeof adapter.pinned === "function"
            ? adapter.pinned(item, input.view, projected, index)
            : dimensions.pinned ?? item?.pinned;

        return {
          id,
          x: projectable ? projected.x : Number.NaN,
          y: projectable ? projected.y : Number.NaN,
          visible: Boolean(projectable),
          priority,
          pinned,
          collisionPadding: dimensions.collisionPadding,
          width: dimensions.width,
          height: dimensions.height,
          anchor: dimensions.anchor,
          marker: dimensions.marker,
          label: dimensions.label,
          placements: dimensions.placements,
          variants: dimensions.variants,
        };
      });

      return session.update({
        markers,
        viewport,
        pressure,
        epoch,
        densityOrigin: input.densityOrigin,
        obstacles: input.obstacles ?? input.obstacleBoxes,
      });
    },

    reset() {
      session.reset();
    },

    snapshot() {
      return session.snapshot();
    },
  };
};
