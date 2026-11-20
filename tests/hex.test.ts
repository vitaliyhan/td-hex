import { describe, expect, it } from "vitest";
import {
  axialToOffset,
  cellToAxial,
  hexDistance,
  hexToPixel,
  neighbours,
  offsetToAxial,
  parseKey,
  cellKey,
  pixelToCell,
} from "../src/hex";

describe("hex coords", () => {
  it("offset <-> axial roundtrips", () => {
    for (let row = 0; row < 11; row++) {
      for (let col = 0; col < 15; col++) {
        const a = offsetToAxial(col, row);
        expect(axialToOffset(a.q, a.r)).toEqual({ col, row });
      }
    }
  });

  it("key roundtrip", () => {
    expect(parseKey(cellKey(3, 7))).toEqual({ col: 3, row: 7 });
  });

  it("neighbours are all distance 1", () => {
    const c = { col: 7, row: 5 };
    for (const n of neighbours(c)) {
      expect(hexDistance(c, n)).toBe(1);
    }
    expect(neighbours(c)).toHaveLength(6);
  });

  it("odd and even rows have distinct neighbour offsets but consistent count", () => {
    expect(neighbours({ col: 7, row: 4 })).toHaveLength(6);
    expect(neighbours({ col: 7, row: 5 })).toHaveLength(6);
  });

  it("pixelToCell inverts hexToPixel at all centers", () => {
    const size = 34;
    for (let row = 0; row < 11; row++) {
      for (let col = 0; col < 15; col++) {
        const { x, y } = hexToPixel({ col, row }, size);
        expect(pixelToCell(x, y, size)).toEqual({ col, row });
      }
    }
  });

  it("distance grows along a straight line", () => {
    expect(hexDistance({ col: 0, row: 5 }, { col: 14, row: 5 })).toBe(14);
    expect(hexDistance({ col: 0, row: 0 }, { col: 0, row: 10 })).toBe(10);
  });

  it("cellToAxial matches offsetToAxial", () => {
    expect(cellToAxial({ col: 10, row: 6 })).toEqual(offsetToAxial(10, 6));
  });
});
