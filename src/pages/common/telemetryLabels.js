const normalizeText = (value) => {
    if (!value) return "";
    return String(value).trim();
};

const titleCase = (value) => {
    if (!value) return "";
    const text = String(value).trim();
    if (!text) return "";
    return `${text.charAt(0).toUpperCase()}${text.slice(1).toLowerCase()}`;
};

const formatInstanceSuffix = (instance) => {
    if (instance === null || instance === undefined || instance === "") return "";
    const instanceText = String(instance).trim();
    if (!instanceText) return "";
    return ` ${instanceText}`;
};

export const formatNodeTitle = (device) => {
    const nodeType = normalizeText(device?.nodeType || device?.meta?.nodeType || device?.extra?.nodeType);
    const nodeId = normalizeText(device?.nodeId || device?.meta?.nodeId || device?.extra?.nodeId);
    const nodeInstance = device?.nodeInstance ?? device?.meta?.nodeInstance ?? device?.extra?.nodeInstance;
    const instanceSuffix = formatInstanceSuffix(nodeInstance);

    if (nodeType && nodeId) {
        return `${titleCase(nodeType)} ${nodeId}${instanceSuffix}`;
    }

    if (nodeType && nodeInstance) {
        return `${titleCase(nodeType)}${instanceSuffix}`;
    }

    if (nodeId) {
        return `Node ${nodeId}${instanceSuffix}`;
    }

    const fallback =
        normalizeText(device?.displayName) ||
        normalizeText(device?.deviceName) ||
        normalizeText(device?.name);
    return fallback || "Sensor node";
};

export const formatNodeSubtitle = (device) => {
    const rackId = normalizeText(device?.rackId || device?.rack || device?.meta?.rackId || device?.meta?.rack);
    const siteId = normalizeText(device?.siteId || device?.site || device?.systemId || device?.system);
    if (!rackId || !siteId) {
        return "";
    }
    return `${rackId} · ${siteId}`;
};

export const formatNodeOptionLabel = (device) => {
    const title = formatNodeTitle(device);
    const subtitle = formatNodeSubtitle(device);
    if (!subtitle) return title;
    return `${title} — ${subtitle}`;
};

export const getDeviceDebugId = (device) => {
    return normalizeText(device?.deviceId || device?.deviceKey || "");
};
