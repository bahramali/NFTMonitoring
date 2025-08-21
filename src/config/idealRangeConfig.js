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
    do: {
        idealRange: { min: 5, max: 8 },
        description: 'Dissolved oxygen ideal range is roughly 5–8 mg/L.'
    },
    dissolvedOxygen: {
        idealRange: { min: 5, max: 8 },
        description: 'Dissolved oxygen ideal range is roughly 5–8 mg/L.'
    },
    '415nm': {
        idealRange: { min: 2, max: 50 },
        description: 'Supports early cell growth.',
        spectralRange: '400\u2013430 nm',
        color: 'Violet'
    },
    '445nm': {
        idealRange: { min: 80, max: 200 },
        description: 'Key for chlorophyll and leafy growth.',
        spectralRange: '430\u2013460 nm',
        color: 'Blue'
    },
    '480nm': {
        idealRange: { min: 70, max: 180 },
        description: 'Blue-green light; supports vegetative growth and pigment production.',
        spectralRange: '460\u2013500 nm',
        color: 'Cyan'
    },
    '515nm': {
        idealRange: { min: 40, max: 150 },
        description: 'Green light; penetrates deeper into leaves and regulates growth balance.',
        spectralRange: '500\u2013530 nm',
        color: 'Green'
    },
    '555nm': {
        idealRange: { min: 80, max: 200 },
        description: 'Mid-green light; complements blue and red for fuller spectrum balance.',
        spectralRange: '530\u2013570 nm',
        color: 'Green/Yellow'
    },
    '590nm': {
        idealRange: { min: 50, max: 140 },
        description: 'Yellow light; minor effect on photosynthesis but supports photomorphogenesis.',
        spectralRange: '570\u2013610 nm',
        color: 'Yellow/Orange'
    },
    '630nm': {
        idealRange: { min: 120, max: 300 },
        description: 'Helps in flowering and general development.',
        spectralRange: '610\u2013650 nm',
        color: 'Orange/Red'
    },
    '680nm': {
        idealRange: { min: 130, max: 320 },
        description: 'Peak light absorption for photosynthesis.',
        spectralRange: '650\u2013700 nm',
        color: 'Red'
    },
    clear: {
        idealRange: { min: 300, max: 900 },
        description: 'Total visible light intensity. General index of light.',
        spectralRange: 'full visible spectrum',
        color: 'All colors'
    },
    nir: {
        idealRange: { min: 20, max: 100 },
        description: 'Higher NIR may indicate heat. Keep it low indoors.',
        spectralRange: '>700 nm',
        color: 'Near Infrared'
    }
};

export default idealRangeConfig;
