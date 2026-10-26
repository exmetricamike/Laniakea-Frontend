import { describe, expect, it } from "vitest";
import { lifecycleActions } from "@/components/controls/system-actions";

describe("lifecycleActions", () => {
  it("only exposes lifecycle actions advertised by the server", () => {
    expect(lifecycleActions(["stop", "new_order", "close_position"])).toEqual(["stop"]);
    expect(lifecycleActions(["ack"])).toEqual(["ack"]);
    expect(lifecycleActions([])).toEqual([]);
  });
});
