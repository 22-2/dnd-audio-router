import { describe, expect, it } from "vitest";

import { formatPan } from "./pan";

describe("formatPan", () => {
  it("0は中央と表す", () => {
    expect(formatPan(0)).toBe("中央");
  });

  it("負の値は左、正の値は右と、絶対値を付けて表す", () => {
    expect(formatPan(-40)).toBe("左40");
    expect(formatPan(25)).toBe("右25");
  });

  it("端の値は-100と100で表す", () => {
    expect(formatPan(-100)).toBe("左100");
    expect(formatPan(100)).toBe("右100");
  });
});
