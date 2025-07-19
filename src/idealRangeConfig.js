const idealRangeConfig = {
    temperature: {
        idealRange: { min: 20, max: 30 },
        description: 'Ideal range for basil growth is 20\u201330\xB0C. Below 18\xB0C or above 32\xB0C may slow growth.'
    },
    humidity: {
        idealRange: { min: 50, max: 70 },
        description: 'Best humidity for basil is between 50% and 70%. Too dry or too wet affects leaf quality.'
    },
    lux: {
        idealRange: { min: 800, max: 2000 },
        description: 'Basil needs strong light. 800\u20132000 lux is ideal for indoor growth.'
    },
    tds: {
        idealRange: { min: 700, max: 1200 },
        description: 'TDS level shows nutrient concentration. Below 600 = weak; above 1400 = overfed.'
    },
    ec: {
        idealRange: { min: 1.1, max: 1.8 },
        description: 'EC is based on TDS. 1.1\u20131.8 mS/cm is ideal for basil in hydroponics.'
    },
    ph: {
        idealRange: { min: 5.8, max: 6.5 },
        description: 'pH affects nutrient absorption. 6.0 is optimal for basil.'
    },
    F1: {
        idealRange: { min: 100, max: 500 },
        description: 'Supports early cell growth.'
    },
    F2: {
        idealRange: { min: 200, max: 600 },
        description: 'Key for chlorophyll and leafy growth.'
    },
    F7: {
        idealRange: { min: 300, max: 800 },
        description: 'Helps in flowering and general development.'
    },
    F8: {
        idealRange: { min: 400, max: 900 },
        description: 'Peak light absorption for photosynthesis.'
    },
    clear: {
        idealRange: { min: 500, max: 2000 },
        description: 'Total visible light intensity. General index of light.'
    },
    nir: {
        idealRange: { min: 0, max: 200 },
        description: 'Higher NIR may indicate heat. Keep it low indoors.'
    }
};

export default idealRangeConfig;
