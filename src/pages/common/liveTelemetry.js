/**
 * @typedef {Record<string, Record<string, any>>} TopicDeviceMap
 * @typedef {Record<string, TopicDeviceMap>} DeviceDataBySite
 */

export const TELEMETRY_DEBUG = import.meta?.env?.VITE_TELEMETRY_DEBUG === "true";

/**
 * @param {string} message
 * @param {unknown} [details]
 */
export function logTelemetryDebug(message, details) {
    if (!TELEMETRY_DEBUG) return;
    if (details === undefined) {
        console.debug(`[telemetry] ${message}`);
        return;
    }
    console.debug(`[telemetry] ${message}`, details);
}

/**
 * @param {DeviceDataBySite} deviceData
 * @returns {TopicDeviceMap}
 */
export function buildAggregatedTopics(deviceData = {}) {
    const allTopics = {};
    if (!deviceData || typeof deviceData !== "object") return allTopics;

    for (const systemTopic of Object.values(deviceData)) {
        if (!systemTopic || typeof systemTopic !== "object") continue;
        for (const [topic, devices] of Object.entries(systemTopic)) {
            if (!devices || typeof devices !== "object") continue;
            allTopics[topic] = { ...(allTopics[topic] || {}), ...devices };
        }
    }

    return allTopics;
}

/**
 * @param {TopicDeviceMap} aggregatedTopics
 * @returns {[string, Record<string, any>][]}
 */
export function buildTopicList(aggregatedTopics = {}) {
    if (!aggregatedTopics || typeof aggregatedTopics !== "object") return [];

    return Object.entries(aggregatedTopics)
        .filter(([, devices = {}]) => Object.keys(devices).length > 0);
}

/**
 * @param {string[]} topics
 * @param {TopicDeviceMap} aggregatedTopics
 * @returns {string[]}
 */
export function resolveTelemetryTopics(topics = [], aggregatedTopics = {}) {
    const keys = new Set();
    const addIfTelemetry = (topic) => {
        if (typeof topic !== "string") return;
        if (topic.includes("telemetry")) {
            keys.add(topic);
        }
    };

    topics.forEach(addIfTelemetry);
    Object.keys(aggregatedTopics || {}).forEach(addIfTelemetry);
    keys.add("telemetry");
    keys.add("hydroleaf/telemetry");

    return Array.from(keys).filter(Boolean);
}
