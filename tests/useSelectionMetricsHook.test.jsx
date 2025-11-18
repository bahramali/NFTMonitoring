import { renderHook } from "@testing-library/react";
import { useSelectionMetrics } from "../src/pages/Reports/hooks/useSelectionMetrics";

const buildDevices = (count) => Array.from({ length: count }, (_, idx) => ({ compositeId: `cid-${idx}` }));

describe("useSelectionMetrics", () => {
    it("derives counts from the provided topic", () => {
        const selected = new Set(["cid-1", "cid-2"]);
        const topicDevices = { foo: buildDevices(5) };
        const { result, rerender } = renderHook(({ selectedIds, topic }) =>
            useSelectionMetrics(selectedIds, topic, topicDevices, ["cid-1", "cid-2", "cid-3"])
        , {
            initialProps: {
                selectedIds: selected,
                topic: "foo",
            },
        });

        expect(result.current).toEqual({
            selectedCompositeCount: 2,
            totalCompositeCount: 5,
            isSelectionEmpty: false,
        });

        rerender({ selectedIds: new Set(), topic: "foo" });
        expect(result.current).toEqual({
            selectedCompositeCount: 0,
            totalCompositeCount: 5,
            isSelectionEmpty: true,
        });
    });

    it("falls back to full composite ids when no topic is selected", () => {
        const selected = new Set(["cid-1"]);
        const { result } = renderHook(() =>
            useSelectionMetrics(selected, null, {}, ["cid-1", "cid-2", "cid-3", "cid-4"])
        );

        expect(result.current).toEqual({
            selectedCompositeCount: 1,
            totalCompositeCount: 4,
            isSelectionEmpty: false,
        });
    });
});
