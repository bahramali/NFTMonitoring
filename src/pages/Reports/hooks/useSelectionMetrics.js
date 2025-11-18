import { useMemo } from "react";

export function useSelectionMetrics(
    selectedCompositeIds,
    selectedTopicId,
    topicDevices,
    compositeIds,
) {
    return useMemo(() => {
        const selectedCount = selectedCompositeIds.size;
        const totalCount = selectedTopicId
            ? (topicDevices[selectedTopicId] || []).length
            : compositeIds.length;

        return {
            selectedCompositeCount: selectedCount,
            totalCompositeCount: totalCount,
            isSelectionEmpty: selectedCount === 0,
        };
    }, [selectedCompositeIds, selectedTopicId, topicDevices, compositeIds]);
}
